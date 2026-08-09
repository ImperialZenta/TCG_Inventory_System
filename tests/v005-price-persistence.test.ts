import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { expandManaboxRowsToUnits, parseManaboxCsv } from "@/lib/manabox/csv-import";
import { applyBreakdownToImport } from "@/lib/staging/apply-breakdown";
import { formalizeStagingImport } from "@/lib/staging/formalize";
import { getDashboardStats, getBlocksWithStats } from "@/lib/blocks";
import { sumLineValueCents } from "@/lib/money";
import { getCardPriceCents, getCardPriceUsd, type ScryfallCard } from "@/lib/scryfall";
import * as scryfall from "@/lib/scryfall";
import { backfillCardLinePrices } from "@/lib/pricing/backfill-prices";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { formalizeImport } from "./helpers/fixtures";

/** Mirrors staging upload persistence in `src/app/staging/actions.ts`. */
async function persistStagingImportFromCsv(raw: string, targetCount = 50): Promise<string> {
  const { rows } = await parseManaboxCsv(raw);
  const units = expandManaboxRowsToUnits(rows);

  const stagingImport = await db.stagingImport.create({
    data: {
      filename: "v005-integration.csv",
      rowCount: units.length,
      status: "PARSED",
      targetCount,
    },
  });

  await db.stagingCard.createMany({
    data: units.map((unit) => ({
      stagingImportId: stagingImport.id,
      scryfallId: unit.scryfallId,
      name: unit.name,
      setCode: unit.setCode,
      collectorNumber: unit.collectorNumber,
      finish: unit.finish,
      language: unit.language,
      condition: unit.condition,
      quantity: 1,
      expansionIndex: unit.expansionIndex,
      sourceRow: unit.sourceRow,
      priceCents: unit.priceCents,
      imageUri: unit.imageUri,
    })),
  });

  await applyBreakdownToImport(stagingImport.id, targetCount);
  return stagingImport.id;
}

describe("V-005 price persistence", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("carries priceCents and imageUri from staging through formalize", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "priced-import.csv",
        rowCount: 1,
        status: "PARSED",
        targetCount: 1,
        cards: {
          create: [
            {
              name: "Priced Card",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 1250,
              imageUri: "https://example.com/card.jpg",
            },
          ],
        },
      },
    });

    const blockIds = await formalizeStagingImport(stagingImport.id, { 1: binId });
    expect(blockIds).toHaveLength(1);

    const block = await db.block.findUnique({
      where: { blockId: blockIds[0]! },
      include: { cards: true },
    });

    expect(block?.cards[0]?.priceCents).toBe(1250);
    expect(block?.cards[0]?.imageUri).toBe("https://example.com/card.jpg");
  });

  it("keeps null price as null on formalize", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "unpriced-import.csv",
        rowCount: 1,
        status: "PARSED",
        targetCount: 1,
        cards: {
          create: [
            {
              name: "Unpriced Card",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: null,
              imageUri: null,
            },
          ],
        },
      },
    });

    await formalizeStagingImport(stagingImport.id, { 1: binId });

    const line = await db.cardLine.findFirst({ where: { name: "Unpriced Card" } });
    expect(line?.priceCents).toBeNull();
  });

  it("sums block value in cents", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "multi-priced.csv",
        rowCount: 2,
        status: "PARSED",
        targetCount: 2,
        cards: {
          create: [
            {
              name: "Card A",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 1250,
            },
            {
              name: "Card B",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 2,
              suggestedBlock: 1,
              priceCents: 350,
            },
          ],
        },
      },
    });

    const blockIds = await formalizeStagingImport(stagingImport.id, { 1: binId });
    const block = await db.block.findUnique({
      where: { blockId: blockIds[0]! },
      include: { cards: true },
    });

    expect(sumLineValueCents(block!.cards)).toBe(1600);
  });

  it("shows non-zero dashboard value when priced inventory exists", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "dashboard-priced.csv",
        rowCount: 1,
        status: "PARSED",
        targetCount: 1,
        cards: {
          create: [
            {
              name: "Dashboard Card",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 500,
            },
          ],
        },
      },
    });

    await formalizeStagingImport(stagingImport.id, { 1: binId });

    const stats = await getDashboardStats();
    expect(stats.totalValueCents).toBeGreaterThan(0);

    const blocks = await getBlocksWithStats();
    expect(blocks.some((b) => b.estimatedValueCents > 0)).toBe(true);
  });

  it("selects finish-aware Scryfall prices", () => {
    const card: ScryfallCard = {
      id: "test-id",
      name: "Test",
      set: "tst",
      collector_number: "1",
      lang: "en",
      finishes: ["nonfoil", "foil"],
      prices: {
        usd: "4.00",
        usd_foil: "22.00",
        usd_etched: null,
      },
    };

    expect(getCardPriceUsd(card, "NONFOIL")).toBe(4);
    expect(getCardPriceUsd(card, "FOIL")).toBe(22);
    expect(getCardPriceCents(card, "FOIL")).toBe(2200);
  });

  it("persists Scryfall price from CSV parse through formalize", async () => {
    vi.spyOn(scryfall, "getScryfallCardBySetAndNumber").mockResolvedValue({
      id: "scry-bolt",
      name: "Lightning Bolt",
      set: "lea",
      collector_number: "161",
      lang: "en",
      finishes: ["nonfoil"],
      image_uris: { small: "https://example.com/bolt.jpg" },
      prices: { usd: "12.50", usd_foil: null, usd_etched: null },
    });

    const csv = [
      "Name,Set Code,Collector Number,Quantity,Condition,Language",
      "Lightning Bolt,lea,161,1,NM,en",
    ].join("\n");

    const importId = await persistStagingImportFromCsv(csv);

    const stagingCard = await db.stagingCard.findFirst({
      where: { stagingImportId: importId },
    });
    expect(stagingCard?.priceCents).toBe(1250);

    const blockIds = await formalizeStagingImport(importId, { 1: binId });
    const line = await db.cardLine.findFirst({ where: { name: "Lightning Bolt" } });
    expect(line?.priceCents).toBe(1250);
    expect(blockIds).toHaveLength(1);

    vi.restoreAllMocks();
  });

  it("persists finish-aware foil price from CSV parse through formalize", async () => {
    vi.spyOn(scryfall, "getScryfallCardBySetAndNumber").mockResolvedValue({
      id: "scry-foil",
      name: "Foil Test",
      set: "tst",
      collector_number: "1",
      lang: "en",
      finishes: ["nonfoil", "foil"],
      prices: { usd: "4.00", usd_foil: "22.00", usd_etched: null },
    });

    const csv = [
      "Name,Set Code,Collector Number,Quantity,Condition,Language,Finish",
      "Foil Test,tst,1,1,NM,en,FOIL",
    ].join("\n");

    const importId = await persistStagingImportFromCsv(csv);
    await formalizeStagingImport(importId, { 1: binId });

    const line = await db.cardLine.findFirst({ where: { name: "Foil Test" } });
    expect(line?.priceCents).toBe(2200);

    vi.restoreAllMocks();
  });

  it("persists image URI from CSV parse through formalize", async () => {
    vi.spyOn(scryfall, "getScryfallCardBySetAndNumber").mockResolvedValue({
      id: "scry-image",
      name: "Image Test",
      set: "lea",
      collector_number: "1",
      lang: "en",
      finishes: ["nonfoil"],
      image_uris: { small: "https://example.com/card.jpg" },
      prices: { usd: "1.00", usd_foil: null, usd_etched: null },
    });

    const csv = [
      "Name,Set Code,Collector Number,Quantity,Condition,Language",
      "Image Test,lea,1,1,NM,en",
    ].join("\n");

    const importId = await persistStagingImportFromCsv(csv);

    const stagingCard = await db.stagingCard.findFirst({
      where: { stagingImportId: importId },
    });
    expect(stagingCard?.imageUri).toBe("https://example.com/card.jpg");

    await formalizeStagingImport(importId, { 1: binId });
    const line = await db.cardLine.findFirst({ where: { name: "Image Test" } });
    expect(line?.imageUri).toBe("https://example.com/card.jpg");

    vi.restoreAllMocks();
  });

  it("keeps null price when Scryfall returns no price through CSV parse", async () => {
    vi.spyOn(scryfall, "getScryfallCardBySetAndNumber").mockResolvedValue({
      id: "scry-unpriced",
      name: "Unpriced Print",
      set: "lea",
      collector_number: "2",
      lang: "en",
      finishes: ["nonfoil"],
      image_uris: { small: "https://example.com/unpriced.jpg" },
      prices: { usd: null, usd_foil: null, usd_etched: null },
    });

    const csv = [
      "Name,Set Code,Collector Number,Quantity,Condition,Language",
      "Unpriced Print,lea,2,1,NM,en",
    ].join("\n");

    const importId = await persistStagingImportFromCsv(csv);

    const stagingCard = await db.stagingCard.findFirst({
      where: { stagingImportId: importId },
    });
    expect(stagingCard?.priceCents).toBeNull();

    await formalizeStagingImport(importId, { 1: binId });
    const line = await db.cardLine.findFirst({ where: { name: "Unpriced Print" } });
    expect(line?.priceCents).toBeNull();

    vi.restoreAllMocks();
  });

  it("excludes null-priced lines from block value totals", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "mixed-priced.csv",
        rowCount: 3,
        status: "PARSED",
        targetCount: 3,
        cards: {
          create: [
            {
              name: "Priced A",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 1250,
            },
            {
              name: "Unpriced B",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 2,
              suggestedBlock: 1,
              priceCents: null,
            },
            {
              name: "Priced C",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 3,
              suggestedBlock: 1,
              priceCents: 350,
            },
          ],
        },
      },
    });

    const blockIds = await formalizeStagingImport(stagingImport.id, { 1: binId });
    const block = await db.block.findUnique({
      where: { blockId: blockIds[0]! },
      include: { cards: true },
    });

    expect(sumLineValueCents(block!.cards)).toBe(1600);

    const blocks = await getBlocksWithStats();
    expect(blocks[0]!.estimatedValueCents).toBe(1600);
  });

  it("sums block estimatedValueCents in getBlocksWithStats", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "block-value.csv",
        rowCount: 3,
        status: "PARSED",
        targetCount: 50,
        cards: {
          create: [
            {
              name: "Value A",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 12500,
            },
            {
              name: "Value B",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 2,
              suggestedBlock: 1,
              priceCents: 12500,
            },
            {
              name: "Value C",
              setCode: "lea",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 3,
              suggestedBlock: 1,
              priceCents: 16250,
            },
          ],
        },
      },
    });

    await formalizeImport(stagingImport.id, binId, 1);

    const blocks = await getBlocksWithStats();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.estimatedValueCents).toBe(41250);
  });

  it("reports unresolved lines during backfill when identity is missing", async () => {
    const block = await db.block.create({
      data: {
        blockId: "MTG-9999",
        status: "OPEN",
        binId,
        cards: {
          create: [
            {
              name: "Mystery Card",
              setCode: "unknown",
              quantity: 1,
              position: 1,
              priceCents: null,
            },
          ],
        },
      },
    });

    const line = await db.cardLine.findFirst({ where: { blockId: block.id } });

    const result = await backfillCardLinePrices(TEST_CONTEXT);

    expect(result.updated).toBe(0);
    expect(result.unresolved.some((u) => u.cardLineId === line!.id)).toBe(true);
  });

  it("backfills priced lines from Scryfall when mocked", async () => {
    const block = await db.block.create({
      data: {
        blockId: "MTG-9998",
        status: "OPEN",
        binId,
        cards: {
          create: [
            {
              name: "Bolt",
              setCode: "lea",
              collectorNumber: "161",
              scryfallId: "scry-bolt",
              finish: "NONFOIL",
              condition: "NM",
              quantity: 1,
              position: 1,
              priceCents: null,
            },
          ],
        },
      },
    });

    const line = await db.cardLine.findFirst({ where: { blockId: block.id } });

    vi.spyOn(scryfall, "getScryfallCardById").mockResolvedValue({
      id: "scry-bolt",
      name: "Lightning Bolt",
      set: "lea",
      collector_number: "161",
      lang: "en",
      finishes: ["nonfoil"],
      prices: { usd: "12.50", usd_foil: null, usd_etched: null },
    });

    const result = await backfillCardLinePrices(TEST_CONTEXT);

    expect(result.updated).toBe(1);

    const updated = await db.cardLine.findUnique({ where: { id: line!.id } });
    expect(updated?.priceCents).toBe(1250);

    vi.restoreAllMocks();
  });

  it("reports unresolved when Scryfall returns image but no price", async () => {
    const block = await db.block.create({
      data: {
        blockId: "MTG-9997",
        status: "OPEN",
        binId,
        cards: {
          create: [
            {
              name: "Image Only",
              setCode: "lea",
              collectorNumber: "99",
              scryfallId: "scry-image-only",
              finish: "NONFOIL",
              condition: "NM",
              quantity: 1,
              position: 1,
              priceCents: null,
            },
          ],
        },
      },
    });

    const line = await db.cardLine.findFirst({ where: { blockId: block.id } });

    vi.spyOn(scryfall, "getScryfallCardById").mockResolvedValue({
      id: "scry-image-only",
      name: "Image Only",
      set: "lea",
      collector_number: "99",
      lang: "en",
      finishes: ["nonfoil"],
      image_uris: { small: "https://example.com/image-only.jpg" },
      prices: { usd: null, usd_foil: null, usd_etched: null },
    });

    const result = await backfillCardLinePrices(TEST_CONTEXT);

    expect(result.updated).toBe(0);
    expect(result.unresolved.some((u) => u.cardLineId === line!.id)).toBe(true);
    expect(result.unresolved.find((u) => u.cardLineId === line!.id)?.reason).toBe(
      "Scryfall returned no price",
    );

    const updated = await db.cardLine.findUnique({ where: { id: line!.id } });
    expect(updated?.imageUri).toBe("https://example.com/image-only.jpg");
    expect(updated?.priceCents).toBeNull();

    vi.restoreAllMocks();
  });
});

describe("createMultiBlockImport with prices", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("formalizes fixture imports without losing optional price fields", async () => {
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: "fixture-priced.csv",
        rowCount: 1,
        status: "PARSED",
        targetCount: 1,
        cards: {
          create: [
            {
              name: "Fixture Card",
              setCode: "tst",
              finish: "NONFOIL",
              condition: "NM",
              language: "en",
              quantity: 1,
              position: 1,
              suggestedBlock: 1,
              priceCents: 99,
            },
          ],
        },
      },
    });

    await formalizeImport(stagingImport.id, binId, 1);

    const line = await db.cardLine.findFirst({ where: { name: "Fixture Card" } });
    expect(line?.priceCents).toBe(99);
  });
});
