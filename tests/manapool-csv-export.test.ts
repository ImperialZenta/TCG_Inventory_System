import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mapManaboxCondition } from "@/lib/languages";
import {
  aggregateCardLinesForListing,
  MANABOX_LISTING_CSV_COLUMNS,
  normalizeCsvForGoldenCompare,
  toManaPoolCsv,
  type ListingLineInput,
} from "@/lib/manapool/csv-export";

const FIXTURES_DIR = path.join(process.cwd(), "docs/fixtures");

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

function parseManaboxStagingCsv(text: string): ListingLineInput[] {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]!).map((c) => c.trim().toLowerCase());
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) {
      throw new Error(`Missing column ${name}`);
    }
    return index;
  };

  const idx = {
    name: col("name"),
    setCode: col("set code"),
    setName: col("set name"),
    collectorNumber: col("collector number"),
    foil: col("foil"),
    rarity: col("rarity"),
    quantity: col("quantity"),
    scryfallId: col("scryfall id"),
    purchasePrice: col("purchase price"),
    condition: col("condition"),
    language: col("language"),
  };

  return lines.slice(1).map((line) => {
    const fields = parseCsvLine(line).map((f) => f.trim());
    const foil = fields[idx.foil] ?? "normal";
    const conditionRaw = fields[idx.condition] ?? "near_mint";
    const purchase = Number.parseFloat(fields[idx.purchasePrice] ?? "0") || 0;

    return {
      scryfallId: fields[idx.scryfallId] ?? "",
      isBulkLine: false,
      name: fields[idx.name] ?? "",
      setCode: fields[idx.setCode] ?? "",
      collectorNumber: fields[idx.collectorNumber] ?? "",
      setName: fields[idx.setName] ?? "",
      rarity: fields[idx.rarity] ?? "common",
      finish: foil === "foil" ? "FOIL" : "NONFOIL",
      condition: mapManaboxCondition(conditionRaw) ?? "NM",
      language: fields[idx.language] ?? "en",
      quantity: Number.parseInt(fields[idx.quantity] ?? "1", 10) || 1,
      priceCents: Math.round(purchase * 100),
    };
  });
}

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

describe("CHL-009 Mana Pool CSV export", () => {
  it("emits ManaBox column headers", () => {
    const csv = toManaPoolCsv([]);
    expect(csv.split("\n")[0]).toBe(MANABOX_LISTING_CSV_COLUMNS.join(","));
    expect(csv).toContain("Purchase price");
  });

  it("golden CSV matches fixture for staging-01 block", () => {
    const stagingCsv = readFileSync(
      path.join(FIXTURES_DIR, "staging-01-single-block.csv"),
      "utf8",
    );
    const goldenCsv = readFileSync(
      path.join(FIXTURES_DIR, "manapool-listing-staging-01.csv"),
      "utf8",
    );

    const rows = aggregateCardLinesForListing(parseManaboxStagingCsv(stagingCsv));
    const actual = normalizeCsvForGoldenCompare(toManaPoolCsv(rows));
    const expected = normalizeCsvForGoldenCompare(goldenCsv.trim());

    expect(actual).toBe(expected);
  });

  it("cross-block aggregation matches merged golden fixture", () => {
    const stagingCsv = readFileSync(
      path.join(FIXTURES_DIR, "staging-02-two-blocks.csv"),
      "utf8",
    );
    const goldenCsv = readFileSync(
      path.join(FIXTURES_DIR, "manapool-upload-session-merged.csv"),
      "utf8",
    );

    const rows = aggregateCardLinesForListing(parseManaboxStagingCsv(stagingCsv));
    const actual = normalizeCsvForGoldenCompare(toManaPoolCsv(rows));
    const expected = normalizeCsvForGoldenCompare(goldenCsv.trim());

    expect(actual).toBe(expected);
  });

  it("merges identical printings across blocks", () => {
    const scryfallId = "bolt-scryfall-merge-test";
    const lines: ListingLineInput[] = [
      {
        scryfallId,
        isBulkLine: false,
        name: "Lightning Bolt",
        setCode: "lea",
        collectorNumber: "123",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 2,
        priceCents: 100,
      },
      {
        scryfallId,
        isBulkLine: false,
        name: "Lightning Bolt",
        setCode: "lea",
        collectorNumber: "123",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 1,
        priceCents: 100,
      },
    ];

    const csv = toManaPoolCsv(aggregateCardLinesForListing(lines));
    expect(csvQuantityForScryfallId(csv, scryfallId)).toBe(3);
    expect(csv).toContain("mint");
    expect(csv).not.toContain("near_mint");
    expect(csv).toContain("normal");
  });

  it("excludes bulk lines without Scryfall ID", () => {
    const rows = aggregateCardLinesForListing([
      {
        scryfallId: null,
        isBulkLine: true,
        name: "Bulk pile",
        setCode: "bulk",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 50,
      },
      {
        scryfallId: "only-real-card",
        isBulkLine: false,
        name: "Real Card",
        setCode: "tst",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 1,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(toManaPoolCsv(rows)).toContain("only-real-card");
    expect(toManaPoolCsv(rows)).not.toContain("Bulk pile");
  });
});

function listingLine(condition: string): ListingLineInput {
  return {
    scryfallId: `scryfall-${condition}`,
    isBulkLine: false,
    name: `Card ${condition}`,
    setCode: "tst",
    collectorNumber: "1",
    condition,
    finish: "NONFOIL",
    language: "en",
    quantity: 1,
  };
}

function csvConditionForScryfallId(csv: string, scryfallId: string): string | undefined {
  const lines = csv.trim().split("\n");
  const header = lines[0]!.split(",");
  const scryfallIdx = header.indexOf("Scryfall ID");
  const conditionIdx = header.indexOf("Condition");
  if (scryfallIdx < 0 || conditionIdx < 0) {
    return undefined;
  }

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(",");
    if (cols[scryfallIdx] === scryfallId) {
      return cols[conditionIdx];
    }
  }
  return undefined;
}

describe("CHL-016 Mana Pool export condition vocabulary", () => {
  it.each([
    ["NM", "mint"],
    ["LP", "near_mint"],
    ["MP", "good"],
    ["HP", "light_played"],
    ["DMG", "poor"],
  ] as const)("internal %s exports as %s", (internal, expected) => {
    const csv = toManaPoolCsv(aggregateCardLinesForListing([listingLine(internal)]));
    expect(csvConditionForScryfallId(csv, `scryfall-${internal}`)).toBe(expected);
  });

  it("internal NM exports as mint, not near_mint", () => {
    const csv = toManaPoolCsv(aggregateCardLinesForListing([listingLine("NM")]));
    expect(csv).toContain("mint");
    expect(csv).not.toContain("near_mint");
  });
});

export { csvQuantityForScryfallId };
