import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { formalizeStagingImport } from "@/lib/staging/formalize";
import { getQtyGroupWarnings } from "@/lib/staging/review";
import {
  assignPositionsFromOrder,
  ReorderBlockError,
  reorderStagingBlockCards,
} from "@/lib/staging/reorder-block";
import { createMultiBlockImport } from "./helpers/fixtures";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { applyBreakdownToImport } from "@/lib/staging/apply-breakdown";

describe("staging pack order (I-027)", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("assignPositionsFromOrder maps IDs to 1..N", () => {
    const positions = assignPositionsFromOrder(["c", "a", "b"]);
    expect(positions.get("c")).toBe(1);
    expect(positions.get("a")).toBe(2);
    expect(positions.get("b")).toBe(3);
  });

  it("reorderStagingBlockCards persists positions within a block", async () => {
    const { importId } = await createMultiBlockImport(1, { targetCount: 3 });
    const cards = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
      orderBy: { position: "asc" },
    });
    expect(cards).toHaveLength(2);

    const reversed = [...cards].reverse().map((c) => c.id);
    await reorderStagingBlockCards(TEST_OWNER_CONTEXT, importId, 1, reversed);

    const updated = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
      orderBy: { position: "asc" },
    });
    expect(updated.map((c) => c.id)).toEqual(reversed);
    expect(updated.map((c) => c.position)).toEqual([1, 2]);
  });

  it("rejects a partial card list", async () => {
    const { importId } = await createMultiBlockImport(1);
    const cards = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
    });

    await expect(
      reorderStagingBlockCards(TEST_OWNER_CONTEXT, importId, 1, [cards[0]!.id]),
    ).rejects.toThrow(ReorderBlockError);
  });

  it("rejects reorder when import is already formalized", async () => {
    const { binId } = await resetTestDb();
    const { importId } = await createMultiBlockImport(1);
    await formalizeStagingImport(TEST_OWNER_CONTEXT, importId, { 1: binId });

    const cards = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
    });

    await expect(
      reorderStagingBlockCards(
        TEST_OWNER_CONTEXT,
        importId,
        1,
        cards.map((c) => c.id),
      ),
    ).rejects.toThrow(/formalized/i);
  });

  it("formalize creates card lines in saved pack order", async () => {
    const { binId } = await resetTestDb();
    const { importId } = await createMultiBlockImport(1, { targetCount: 3 });

    const cards = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
      orderBy: { position: "asc" },
    });
    const reversed = [...cards].reverse().map((c) => c.id);
    await reorderStagingBlockCards(TEST_OWNER_CONTEXT, importId, 1, reversed);

    const blockIds = await formalizeStagingImport(TEST_OWNER_CONTEXT, importId, { 1: binId });
    expect(blockIds).toHaveLength(1);

    const block = await db.block.findFirst({
      where: { blockId: blockIds[0] },
      include: { cards: { orderBy: { position: "asc" } } },
    });
    expect(block?.cards.map((c) => c.name)).toEqual(
      reversed.map((id) => cards.find((c) => c.id === id)!.name),
    );
    expect(block?.cards.map((c) => c.position)).toEqual([1, 2]);
  });

  it("duplicate placement warnings reflect saved positions", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "qty-group.csv",
        rowCount: 3,
        status: "PARSED",
        targetCount: 10,
        cards: {
          create: [
            {
              name: "Lightning Bolt",
              setCode: "lea",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              sourceRow: 1,
              expansionIndex: 0,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
            {
              name: "Lightning Bolt",
              setCode: "lea",
              quantity: 1,
              position: 2,
              suggestedBlock: 1,
              sourceRow: 1,
              expansionIndex: 1,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
            {
              name: "Other Card",
              setCode: "lea",
              quantity: 1,
              position: 3,
              suggestedBlock: 1,
              sourceRow: 2,
              expansionIndex: 0,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
          ],
        },
      },
      include: { cards: true },
    });

    const cardIds = stagingImport.cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const reordered = [cardIds[2]!.id, cardIds[0]!.id, cardIds[1]!.id];
    await reorderStagingBlockCards(
      TEST_OWNER_CONTEXT,
      stagingImport.id,
      1,
      reordered,
    );

    const refreshed = await db.stagingCard.findMany({
      where: { stagingImportId: stagingImport.id },
    });
    const { adjacencyReminders } = getQtyGroupWarnings(refreshed);
    expect(adjacencyReminders).toHaveLength(1);
    expect(adjacencyReminders[0]?.placements[0]).toMatch(/Block 1 pos 2–3/);
  });

  it("recalculate restores CSV row order after a custom pack order", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "csv-order.csv",
        rowCount: 3,
        status: "PARSED",
        targetCount: 10,
        cards: {
          create: [
            {
              name: "Alpha",
              setCode: "tst",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              sourceRow: 1,
              expansionIndex: 0,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
            {
              name: "Beta",
              setCode: "tst",
              quantity: 1,
              position: 2,
              suggestedBlock: 1,
              sourceRow: 2,
              expansionIndex: 0,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
            {
              name: "Gamma",
              setCode: "tst",
              quantity: 1,
              position: 3,
              suggestedBlock: 1,
              sourceRow: 3,
              expansionIndex: 0,
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
            },
          ],
        },
      },
      include: { cards: true },
    });

    const csvOrder = [...stagingImport.cards].sort(
      (a, b) => (a.sourceRow ?? 0) - (b.sourceRow ?? 0),
    );
    const customOrder = [csvOrder[2]!, csvOrder[0]!, csvOrder[1]!].map((c) => c.id);
    await reorderStagingBlockCards(
      TEST_OWNER_CONTEXT,
      stagingImport.id,
      1,
      customOrder,
    );

    const reordered = await db.stagingCard.findMany({
      where: { stagingImportId: stagingImport.id, suggestedBlock: 1 },
      orderBy: { position: "asc" },
    });
    expect(reordered.map((c) => c.name)).toEqual(["Gamma", "Alpha", "Beta"]);

    await applyBreakdownToImport(stagingImport.id, 10);

    const restored = await db.stagingCard.findMany({
      where: { stagingImportId: stagingImport.id },
      orderBy: [{ suggestedBlock: "asc" }, { position: "asc" }],
    });
    expect(restored.map((c) => c.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(restored.map((c) => c.position)).toEqual([1, 2, 3]);
  });
});
