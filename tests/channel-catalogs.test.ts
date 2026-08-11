import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import {
  assignBinToCatalog,
  ChannelCatalogError,
  createChannelCatalog,
  getCatalogWithBins,
  listChannelCatalogs,
  removeBinFromCatalog,
} from "@/lib/channel-catalogs";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

async function createTestBins() {
  const shelf = await db.shelf.findFirst();
  if (!shelf) throw new Error("Expected test shelf");

  const binA = await db.bin.create({
    data: { binId: "A-01", shelfId: shelf.id, label: "Bin A-01", sortOrder: 1 },
  });
  const binB = await db.bin.create({
    data: { binId: "A-02", shelfId: shelf.id, label: "Bin A-02", sortOrder: 2 },
  });

  return { binA, binB };
}

describe("channel catalogs (CHL-001)", () => {
  let defaultBinId: string;

  beforeEach(async () => {
    ({ binId: defaultBinId } = await resetTestDb());
    void defaultBinId;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("assigns two bins to the Mana Pool catalog", async () => {
    const { binA, binB } = await createTestBins();
    const catalog = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");

    await assignBinToCatalog(TEST_CONTEXT, catalog.id, binA.id);
    await assignBinToCatalog(TEST_CONTEXT, catalog.id, binB.id);

    const detail = await getCatalogWithBins(catalog.id);
    expect(detail?.bins.map((b) => b.binDisplayId).sort()).toEqual(["A-01", "A-02"]);

    const listed = await listChannelCatalogs("MANAPOOL");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.label).toBe("Mana Pool — Shelf A");
    expect(listed[0]?.memberCount).toBe(2);
  });

  it("rejects a bin joining two Mana Pool catalogs", async () => {
    const { binA } = await createTestBins();
    const first = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");
    const second = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf B");

    await assignBinToCatalog(TEST_CONTEXT, first.id, binA.id);

    await expect(assignBinToCatalog(TEST_CONTEXT, second.id, binA.id)).rejects.toThrow(
      ChannelCatalogError,
    );
    await expect(assignBinToCatalog(TEST_CONTEXT, second.id, binA.id)).rejects.toThrow(
      /Mana Pool catalog "Mana Pool — Shelf A"/,
    );
  });

  it("allows the same bin on different channel catalogs", async () => {
    const { binA } = await createTestBins();
    const manaPool = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");
    const tcgplayer = await createChannelCatalog(TEST_CONTEXT, "TCGPLAYER", "TCGplayer — Shelf A");

    await assignBinToCatalog(TEST_CONTEXT, manaPool.id, binA.id);
    await assignBinToCatalog(TEST_CONTEXT, tcgplayer.id, binA.id);

    const manaDetail = await getCatalogWithBins(manaPool.id);
    const tcgDetail = await getCatalogWithBins(tcgplayer.id);
    expect(manaDetail?.bins).toHaveLength(1);
    expect(tcgDetail?.bins).toHaveLength(1);
    expect(manaDetail?.bins[0]?.binDisplayId).toBe("A-01");
    expect(tcgDetail?.bins[0]?.binDisplayId).toBe("A-01");
  });

  it("does not change block status when removing a bin from a catalog", async () => {
    const { binA } = await createTestBins();
    const fixture = await createFormalizedImport(binA.id, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);

    const catalog = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");
    await assignBinToCatalog(TEST_CONTEXT, catalog.id, binA.id);

    const blockBefore = await db.block.findUnique({ where: { blockId: fixture.blockIds[0]! } });
    expect(blockBefore?.status).toBe("SEALED");

    await removeBinFromCatalog(TEST_CONTEXT, catalog.id, binA.id);

    const blockAfter = await db.block.findUnique({ where: { blockId: fixture.blockIds[0]! } });
    expect(blockAfter?.status).toBe("SEALED");

    const detail = await getCatalogWithBins(catalog.id);
    expect(detail?.bins).toHaveLength(0);
  });
});
