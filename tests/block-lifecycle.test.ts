import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import {
  getAvailableTransitions,
  LifecycleError,
  transitionBlockStatus,
} from "@/lib/blocks/lifecycle";
import { getImportUndoSummary } from "@/lib/staging/undo-formalize";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

describe("block lifecycle (B-002)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("activates a sealed block and sets activatedAt", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);

    const result = await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");
    expect(result.message).toMatch(/active/i);

    const block = await db.block.findUnique({ where: { blockId } });
    expect(block?.status).toBe("ACTIVE");
    expect(block?.activatedAt).not.toBeNull();

    const event = await db.inventoryEvent.findFirst({
      where: {
        blockId: fixture.internalIds[0],
        eventType: "block.lifecycle",
      },
    });
    expect(event).not.toBeNull();
    expect(event?.summary).toMatch(/active/i);
  });

  it("archives from ACTIVE", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");

    await transitionBlockStatus(TEST_CONTEXT, blockId, "ARCHIVE");

    const block = await db.block.findUnique({ where: { blockId } });
    expect(block?.status).toBe("ARCHIVED");
  });

  it("archives from SEALED without activating (never-listed path)", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);

    await transitionBlockStatus(TEST_CONTEXT, blockId, "ARCHIVE");

    const block = await db.block.findUnique({ where: { blockId } });
    expect(block?.status).toBe("ARCHIVED");
    expect(block?.activatedAt).toBeNull();
  });

  it("liquidates from ARCHIVED and has no further transitions", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ARCHIVE");
    await transitionBlockStatus(TEST_CONTEXT, blockId, "LIQUIDATE");

    const block = await db.block.findUnique({ where: { blockId } });
    expect(block?.status).toBe("LIQUIDATED");
    expect(getAvailableTransitions("LIQUIDATED")).toEqual([]);
  });

  it("rejects ACTIVE → LIQUIDATE and OPEN → ACTIVATE shortcuts", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;

    await expect(transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE")).rejects.toBeInstanceOf(
      LifecycleError,
    );
    await expect(transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE")).rejects.toThrow(/unsealed|open/i);

    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");

    await expect(transitionBlockStatus(TEST_CONTEXT, blockId, "LIQUIDATE")).rejects.toBeInstanceOf(
      LifecycleError,
    );
    await expect(transitionBlockStatus(TEST_CONTEXT, blockId, "LIQUIDATE")).rejects.toThrow(/active/i);
  });

  it("blocks undo formalize after a linked block is sealed", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);

    const summary = await getImportUndoSummary(fixture.importId);
    expect(summary.canUndo).toBe(false);
    expect(summary.blockReason).toMatch(/sealed/i);
  });
});
