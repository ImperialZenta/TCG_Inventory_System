import type { CardLine } from "@prisma/client";
import {
  FINISH_TO_MANABOX_FOIL,
  INTERNAL_TO_MANAPOOL_CONDITION,
} from "@/lib/languages";

/** ManaBox export header — Mana Pool accepts this for new listing imports. */
export const MANABOX_LISTING_CSV_COLUMNS = [
  "Name",
  "Set code",
  "Set name",
  "Collector number",
  "Foil",
  "Rarity",
  "Quantity",
  "ManaBox ID",
  "Scryfall ID",
  "Purchase price",
  "Misprint",
  "Altered",
  "Condition",
  "Language",
  "Purchase price currency",
  "Added",
] as const;

export interface ListingLineInput {
  scryfallId: string | null;
  isBulkLine: boolean;
  name: string;
  setCode: string;
  collectorNumber?: string | null;
  condition: string;
  finish: string;
  language: string;
  quantity: number;
  priceCents?: number | null;
  setName?: string | null;
  rarity?: string | null;
}

export interface ManaPoolCsvRow {
  scryfallId: string;
  language: string;
  finish: string;
  condition: string;
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
  setName: string;
  rarity: string;
  priceCents: number | null;
}

function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatPurchasePrice(priceCents: number | null | undefined): string {
  if (priceCents == null) {
    return "";
  }
  return (priceCents / 100).toFixed(2);
}

function internalConditionToManapool(condition: string): string {
  return INTERNAL_TO_MANAPOOL_CONDITION[condition] ?? "mint";
}

function internalFinishToManaboxFoil(finish: string): string {
  return FINISH_TO_MANABOX_FOIL[finish] ?? "normal";
}

/** Aggregate card lines by identity for Mana Pool listing export. */
export function aggregateCardLinesForListing(
  lines: Array<CardLine | ListingLineInput>,
): ManaPoolCsvRow[] {
  const map = new Map<string, ManaPoolCsvRow>();

  for (const line of lines) {
    if (line.isBulkLine || !line.scryfallId) continue;

    const key = `${line.scryfallId}|${line.condition}|${line.finish}|${line.language}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      const setName = "setName" in line ? (line.setName ?? "") : "";
      const rarity = "rarity" in line ? (line.rarity ?? "common") : "common";
      map.set(key, {
        scryfallId: line.scryfallId,
        language: line.language,
        finish: line.finish,
        condition: line.condition,
        quantity: line.quantity,
        name: line.name,
        setCode: line.setCode,
        collectorNumber: line.collectorNumber ?? "",
        setName,
        rarity,
        priceCents: line.priceCents ?? null,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** ManaBox-compatible CSV for Mana Pool import (CHL-009, CHL-016). */
export function toManaPoolCsv(rows: ManaPoolCsvRow[]): string {
  const header = MANABOX_LISTING_CSV_COLUMNS.join(",");

  const body = rows.map((row) =>
    [
      escapeCsvField(row.name),
      row.setCode,
      escapeCsvField(row.setName),
      row.collectorNumber,
      internalFinishToManaboxFoil(row.finish),
      row.rarity,
      row.quantity,
      "",
      row.scryfallId,
      formatPurchasePrice(row.priceCents),
      "FALSE",
      "FALSE",
      internalConditionToManapool(row.condition),
      row.language,
      "USD",
      "",
    ].join(","),
  );

  return [header, ...body].join("\n");
}

/** Compare CSV rows ignoring Purchase price column values. */
export function normalizeCsvForGoldenCompare(csv: string): string {
  const lines = csv.trim().split("\n");
  if (lines.length === 0) {
    return "";
  }

  const header = parseCsvLine(lines[0]!);
  const priceIdx = header.findIndex((col) => col.toLowerCase() === "purchase price");
  if (priceIdx < 0) {
    return csv.trim();
  }

  return lines
    .map((line, index) => {
      if (index === 0) {
        return line;
      }
      const fields = parseCsvLine(line);
      if (priceIdx < fields.length) {
        fields[priceIdx] = "";
      }
      return fields.map(escapeCsvField).join(",");
    })
    .join("\n");
}

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
