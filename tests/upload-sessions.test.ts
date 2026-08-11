import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT, TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { LifecycleError, transitionBlockStatus } from "@/lib/blocks/lifecycle";
import { RemoveBlockError, removeBlockByBlockId } from "@/lib/blocks/remove";
import { moveBlockToBin } from "@/lib/blocks/move";
import {
  assignBinToCatalog,
  createChannelCatalog,
  removeBinFromCatalog,
} from "@/lib/channel-catalogs";
import { aggregateCardLinesForListing } from "@/lib/manapool/csv-export";
import { allocateCardLineForOrderLine } from "@/lib/pick/allocate";
import { recordCounterPick } from "@/lib/pick/counter-pick";
import {
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  generateUploadSessionCsv,
  getUploadSessionDetail,
  UploadSessionError,
} from "@/lib/upload-sessions";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

async function sealFixture(fixture: Awaited<ReturnType<typeof createFormalizedImport>>) {
  await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
}

/** Parse Quantity column from a Mana Pool CSV row matching scryfallId. */
function csvQuantityForScryfallId(csv: string, scryfallId: string): number | undefined {
  const lines = csv.trim().split("\n");
  const header = lines[0]!.split(",");
  const scryfallIdx = header.indexOf("Scryfall ID");
  const qtyIdx = header.indexOf("Quantity");
  if (scryfallIdx < 0 || qtyIdx < 0) {
    return undefined;
  }

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols[scryfallIdx] === scryfallId) {
      return Number.parseInt(cols[qtyIdx] ?? "", 10);
    }
  }
  return undefined;
}

describe("upload sessions (CHL-003–006, CHL-012, CHL-015 partial)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates a session for five sealed blocks with UP-0001 and reserves them", async () => {
    const fixture = await createFormalizedImport(binId, 5);
    await sealFixture(fixture);

    const result = await createUploadSession(
      TEST_CONTEXT,
      fixture.internalIds,
      "MANAPOOL",
    );

    expect(result.sessionId).toBe("UP-0001");
    expect(result.mtgBlockIds).toHaveLength(5);

    const session = await db.uploadSession.findUnique({
      where: { sessionId: result.sessionId },
    });
    expect(session?.status).toBe("DRAFT");

    for (const internalId of fixture.internalIds) {
      const block = await db.block.findUnique({ where: { id: internalId } });
      expect(block?.reservedUploadSessionId).toBe(session?.id);
    }
  });

  it("rejects OPEN blocks", async () => {
    const fixture = await createFormalizedImport(binId, 1);

    await expect(
      createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL"),
    ).rejects.toThrow(UploadSessionError);
  });

  it("rejects ACTIVE blocks", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ACTIVATE");

    await expect(
      createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL"),
    ).rejects.toThrow(/already active/i);
  });

  it("rejects a block reserved in another open session", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);

    await createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL");

    await expect(
      createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL"),
    ).rejects.toThrow(/reserved/i);
  });

  it("merges identical printings across blocks in session CSV", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);

    const cardName = "Lightning Bolt";
    const scryfallId = "bolt-scryfall-test-id";

    for (const internalId of fixture.internalIds) {
      await db.cardLine.create({
        data: {
          blockId: internalId,
          scryfallId,
          name: cardName,
          setCode: "lea",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: internalId === fixture.internalIds[0] ? 2 : 1,
          position: 99,
        },
      });
    }

    const created = await createUploadSession(
      TEST_CONTEXT,
      fixture.internalIds,
      "MANAPOOL",
    );

    const csvResult = await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);
    expect(csvResult.rowCount).toBe(1);
    expect(csvResult.csv).toContain("Lightning Bolt");
    expect(csvResult.csv).toContain("Purchase price");
    expect(csvQuantityForScryfallId(csvResult.csv, scryfallId)).toBe(3);

    const rows = aggregateCardLinesForListing(
      (
        await db.uploadSession.findUnique({
          where: { sessionId: created.sessionId },
          include: {
            blocks: { include: { block: { include: { cards: true } } } },
          },
        })
      )!.blocks.flatMap((m) => m.block.cards),
    );

    const bolt = rows.find((r) => r.scryfallId === scryfallId);
    expect(bolt?.quantity).toBe(3);

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("CSV_READY");
  });

  it("rejects CSV generate when session holds only bulk lines without Scryfall ID", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    await db.cardLine.deleteMany({ where: { blockId: fixture.internalIds[0]! } });
    await db.cardLine.create({
      data: {
        blockId: fixture.internalIds[0]!,
        scryfallId: null,
        name: "Bulk commons pile",
        setCode: "bulk",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 50,
        position: 1,
        isBulkLine: true,
        bulkDescription: "Mixed commons",
      },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await expect(
      generateUploadSessionCsv(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(/no listable singles/i);
  });

  it("writes a new export audit row on CSV regenerate", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "regenerate-test-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    const first = await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);
    const afterFirst = await getUploadSessionDetail(created.sessionId);
    expect(afterFirst?.latestExport?.rowCount).toBe(first.rowCount);
    expect(afterFirst?.csvGeneratedAt).not.toBeNull();

    const firstGeneratedAt = afterFirst!.csvGeneratedAt!;
    const firstAuditCreatedAt = afterFirst!.latestExport!.createdAt;

    const second = await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);
    const afterSecond = await getUploadSessionDetail(created.sessionId);

    expect(afterSecond?.status).toBe("CSV_READY");
    expect(afterSecond!.csvGeneratedAt!.getTime()).toBeGreaterThanOrEqual(
      firstGeneratedAt.getTime(),
    );
    expect(afterSecond!.latestExport!.rowCount).toBe(second.rowCount);
    expect(afterSecond!.latestExport!.filename).toBe(`${created.sessionId}-manapool-listing.csv`);
    expect(afterSecond!.latestExport!.createdAt.getTime()).toBeGreaterThanOrEqual(
      firstAuditCreatedAt.getTime(),
    );

    const audits = await db.uploadExportAudit.findMany({
      where: { sessionId: afterSecond!.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits).toHaveLength(2);
    expect(audits[1]!.id).toBe(
      (
        await db.uploadExportAudit.findFirst({
          where: { sessionId: afterSecond!.id },
          orderBy: { createdAt: "desc" },
        })
      )!.id,
    );
  });

  it("rejects CSV generate when a session block is no longer sealed", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: { in: fixture.internalIds } },
      data: { scryfallId: "unseal-test-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      fixture.internalIds,
      "MANAPOOL",
    );

    await db.block.update({
      where: { id: fixture.internalIds[0]! },
      data: { status: "OPEN" },
    });

    await expect(
      generateUploadSessionCsv(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(new RegExp(fixture.blockIds[0]!));
  });

  it("rejects complete from DRAFT", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await expect(
      completeUploadSession(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(/CSV_READY/i);
  });

  it("completes session and activates all five blocks", async () => {
    const fixture = await createFormalizedImport(binId, 5);
    await sealFixture(fixture);

    await db.cardLine.updateMany({
      where: { blockId: { in: fixture.internalIds } },
      data: { scryfallId: "test-scryfall-complete" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      fixture.internalIds,
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);

    const result = await completeUploadSession(TEST_CONTEXT, created.sessionId);
    expect(result.mtgBlockIds).toHaveLength(5);

    for (const blockId of fixture.blockIds) {
      const block = await db.block.findUnique({ where: { blockId } });
      expect(block?.status).toBe("ACTIVE");
      expect(block?.channel).toBe("MANAPOOL");
      expect(block?.reservedUploadSessionId).toBeNull();
      expect(block?.activatedAt).not.toBeNull();
    }

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("COMPLETED");

    const completedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: "upload.completed", uploadSessionId: session?.id },
    });
    expect(completedEvent).not.toBeNull();
  });

  it("complete is all-or-nothing when a session block is no longer sealed", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: { in: fixture.internalIds } },
      data: { scryfallId: "complete-guard-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      fixture.internalIds,
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);

    await db.block.update({
      where: { id: fixture.internalIds[1]! },
      data: { status: "OPEN" },
    });

    await expect(
      completeUploadSession(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(new RegExp(fixture.blockIds[1]!));

    for (const blockId of fixture.blockIds) {
      const block = await db.block.findUnique({ where: { blockId } });
      expect(block?.status).toBe(
        blockId === fixture.blockIds[1] ? "OPEN" : "SEALED",
      );
      expect(block?.reservedUploadSessionId).not.toBeNull();
    }

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("CSV_READY");
  });

  it("cancel releases reservations and keeps blocks SEALED", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await cancelUploadSession(TEST_CONTEXT, created.sessionId);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.status).toBe("SEALED");
    expect(block?.reservedUploadSessionId).toBeNull();

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("CANCELLED");
  });

  it("cancel from CSV_READY releases reservations and keeps blocks SEALED", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "cancel-csv-ready-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);

    await cancelUploadSession(TEST_CONTEXT, created.sessionId);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.status).toBe("SEALED");
    expect(block?.reservedUploadSessionId).toBeNull();

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("CANCELLED");
  });

  it("rejects cancel on a completed session", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "cancel-completed-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);
    await completeUploadSession(TEST_CONTEXT, created.sessionId);

    await expect(
      cancelUploadSession(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(/completed/i);
  });

  it("blocks per-block ACTIVATE while reserved and names the session", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await expect(
      transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ACTIVATE"),
    ).rejects.toThrow(LifecycleError);
    await expect(
      transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ACTIVATE"),
    ).rejects.toThrow(new RegExp(created.sessionId));
  });

  it("blocks remove while reserved", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    await createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL");

    await expect(
      removeBlockByBlockId(TEST_OWNER_CONTEXT, fixture.blockIds[0]!),
    ).rejects.toThrow(RemoveBlockError);
  });

  it("excludes reserved blocks from pick allocation", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);

    await createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL");
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[1]!, "ACTIVATE");

    const allocation = await allocateCardLineForOrderLine(
      {
        name: "Test Card B2-P1",
        setCode: "tst",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      },
      new Set(),
      "MANAPOOL",
    );

    expect(allocation?.mtgBlockId).toBe(fixture.blockIds[1]);
    expect(allocation?.mtgBlockId).not.toBe(fixture.blockIds[0]);
  });

  it("rejects counter-pick on reserved block naming the session", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await expect(
      recordCounterPick({ mtgBlockId: fixture.blockIds[0]!, position: 1 }, TEST_CONTEXT),
    ).rejects.toThrow(new RegExp(`upload session ${created.sessionId}`, "i"));
  });

  it("allows pick allocation after session cancel releases the block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await cancelUploadSession(TEST_CONTEXT, created.sessionId);
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ACTIVATE");

    const allocation = await allocateCardLineForOrderLine(
      {
        name: "Test Card B1-P1",
        setCode: "tst",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      },
      new Set(),
      "MANAPOOL",
    );

    expect(allocation?.mtgBlockId).toBe(fixture.blockIds[0]);
  });

  it("allows pick allocation after session complete activates the block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "pick-after-complete-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);
    await completeUploadSession(TEST_CONTEXT, created.sessionId);

    const block = await db.block.findUnique({ where: { blockId: fixture.blockIds[0]! } });
    expect(block?.status).toBe("ACTIVE");
    expect(block?.reservedUploadSessionId).toBeNull();

    const allocation = await allocateCardLineForOrderLine(
      {
        name: "Test Card B1-P1",
        setCode: "tst",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      },
      new Set(),
      "MANAPOOL",
    );

    expect(allocation?.mtgBlockId).toBe(fixture.blockIds[0]);
  });

  it("rejects quarantined blocks from joining a session", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    await db.block.update({
      where: { id: fixture.internalIds[0]! },
      data: { pickHoldAt: new Date(), pickHoldReason: "Test quarantine" },
    });

    await expect(
      createUploadSession(TEST_CONTEXT, [fixture.internalIds[0]!], "MANAPOOL"),
    ).rejects.toThrow(/quarantined/i);
  });

  it("rejects CSV generate when a session block becomes quarantined", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "quarantine-generate-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await db.block.update({
      where: { id: fixture.internalIds[0]! },
      data: { pickHoldAt: new Date(), pickHoldReason: "Test quarantine" },
    });

    await expect(
      generateUploadSessionCsv(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(/quarantined/i);
  });

  it("rejects complete when a session block becomes quarantined", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "quarantine-complete-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);

    await db.block.update({
      where: { id: fixture.internalIds[0]! },
      data: { pickHoldAt: new Date(), pickHoldReason: "Test quarantine" },
    });

    await expect(
      completeUploadSession(TEST_CONTEXT, created.sessionId),
    ).rejects.toThrow(/quarantined/i);
  });

  it("complete is idempotent without duplicate upload.completed events", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "idempotent-complete-id" },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );
    await generateUploadSessionCsv(TEST_CONTEXT, created.sessionId);

    await completeUploadSession(TEST_CONTEXT, created.sessionId);
    await completeUploadSession(TEST_CONTEXT, created.sessionId);

    const session = await db.uploadSession.findUnique({
      where: { sessionId: created.sessionId },
    });
    expect(session?.status).toBe("COMPLETED");

    const completedEvents = await db.inventoryEvent.findMany({
      where: { eventType: "upload.completed", uploadSessionId: session?.id },
    });
    expect(completedEvents).toHaveLength(1);
  });

  it("allows moving a reserved block and keeps it in the session", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealFixture(fixture);

    const shelf = await db.shelf.findFirst();
    const secondBin = await db.bin.create({
      data: {
        binId: "TEST-A-B02",
        shelfId: shelf!.id,
        label: "Second bin",
        sortOrder: 2,
      },
    });

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await moveBlockToBin(TEST_CONTEXT, fixture.blockIds[0]!, secondBin.id);

    const detail = await getUploadSessionDetail(created.sessionId);
    expect(detail?.blocks.map((b) => b.blockId)).toEqual([fixture.blockIds[0]!]);
    expect(detail?.blocks[0]?.locationLabel).toBe("TEST-A / TEST-A-B02");

    const membership = await db.uploadSessionBlock.findFirst({
      where: { session: { sessionId: created.sessionId }, blockId: fixture.internalIds[0]! },
    });
    expect(membership).not.toBeNull();
  });

  it("keeps session membership when a bin is removed from catalog mid-session", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealFixture(fixture);

    const catalog = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");
    await assignBinToCatalog(TEST_CONTEXT, catalog.id, binId);

    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await removeBinFromCatalog(TEST_CONTEXT, catalog.id, binId);

    const detail = await getUploadSessionDetail(created.sessionId);
    expect(detail?.blocks.map((b) => b.blockId)).toEqual([fixture.blockIds[0]!]);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.reservedUploadSessionId).not.toBeNull();
  });
});
