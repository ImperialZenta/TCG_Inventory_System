import type { Condition, Finish } from "@prisma/client";
import {
  LANGUAGES,
  MANAPOOL_TO_FINISH,
  mapManaboxCondition,
} from "@/lib/languages";
import {
  getCardImageUri,
  getCardPriceCents,
  getScryfallCardById,
  getScryfallCardBySetAndNumber,
  type ScryfallCard,
} from "@/lib/scryfall";

export interface ParsedManaboxRow {
  scryfallId: string | null;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  finish: Finish;
  condition: Condition;
  language: string;
  quantity: number;
  priceCents: number | null;
  imageUri: string | null;
  sourceRow: number;
}

/** One physical card after expanding CSV quantity. */
export interface ExpandedManaboxUnit {
  scryfallId: string | null;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  finish: Finish;
  condition: Condition;
  language: string;
  quantity: 1;
  priceCents: number | null;
  imageUri: string | null;
  sourceRow: number;
  expansionIndex: number;
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  "card name": "name",
  "set code": "setCode",
  setcode: "setCode",
  set: "setCode",
  "set name": "setName",
  "collector number": "collectorNumber",
  number: "collectorNumber",
  quantity: "quantity",
  qty: "quantity",
  foil: "foil",
  finish: "finish",
  condition: "condition",
  language: "language",
  lang: "language",
  "scryfall id": "scryfallId",
  scryfallid: "scryfallId",
};

function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/\s+/g, " ");
  return HEADER_ALIASES[key] ?? key;
}

/** Minimal RFC4180-style CSV row parser. */
function parseCsvRows(raw: string): string[][] {
  const text = raw.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
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
      row.push(field);
      field = "";
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      if (char === "\r") i++;
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function mapLanguage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "en";

  const lower = trimmed.toLowerCase();
  const byScryfall = LANGUAGES.find((l) => l.scryfallCode === lower);
  if (byScryfall) return byScryfall.scryfallCode;

  const upper = trimmed.toUpperCase();
  const byManapool = LANGUAGES.find((l) => l.manapoolCode === upper);
  if (byManapool) return byManapool.scryfallCode;

  return lower.slice(0, 3);
}

function mapFinish(foilRaw: string, finishRaw: string): Finish {
  const finish = finishRaw.trim().toUpperCase();
  if (finish in MANAPOOL_TO_FINISH) {
    return MANAPOOL_TO_FINISH[finish];
  }
  if (finish === "NONFOIL" || finish === "NF" || finish === "NORMAL") return "NONFOIL";
  if (finish === "FOIL" || finish === "FO") return "FOIL";
  if (finish === "ETCHED" || finish === "EF") return "ETCHED";

  const foil = foilRaw.trim().toLowerCase();
  if (foil.includes("etched")) return "ETCHED";
  if (foil === "foil" || foil === "true" || foil === "yes" || foil === "1") return "FOIL";
  return "NONFOIL";
}

function mapCondition(raw: string): Condition | null {
  const trimmed = raw.trim();
  if (!trimmed) return "NM";

  const upper = trimmed.toUpperCase();
  if (["NM", "LP", "MP", "HP", "DMG"].includes(upper)) {
    return upper as Condition;
  }

  return mapManaboxCondition(trimmed);
}

function rowToRecord(headers: string[], cells: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    record[headers[i]] = (cells[i] ?? "").trim();
  }
  return record;
}

function applyScryfallEnrichment(
  row: ParsedManaboxRow,
  card: ScryfallCard,
): ParsedManaboxRow {
  return {
    ...row,
    scryfallId: card.id,
    name: row.name || card.name,
    setCode: card.set.toLowerCase(),
    imageUri: getCardImageUri(card) ?? null,
    priceCents: getCardPriceCents(card, row.finish),
  };
}

async function enrichRow(row: ParsedManaboxRow): Promise<ParsedManaboxRow> {
  if (row.priceCents != null && row.imageUri != null) {
    return row;
  }

  try {
    let card: ScryfallCard | null = null;

    if (row.scryfallId) {
      card = await getScryfallCardById(row.scryfallId);
    } else if (row.setCode && row.collectorNumber) {
      card = await getScryfallCardBySetAndNumber(row.setCode, row.collectorNumber);
    }

    if (!card) return row;

    return applyScryfallEnrichment(row, card);
  } catch {
    return row;
  }
}

/** Expand CSV quantity into one unit per physical card (CSV row order preserved). */
export function expandManaboxRowsToUnits(rows: ParsedManaboxRow[]): ExpandedManaboxUnit[] {
  const units: ExpandedManaboxUnit[] = [];

  for (const row of rows) {
    for (let expansionIndex = 0; expansionIndex < row.quantity; expansionIndex++) {
      units.push({
        scryfallId: row.scryfallId,
        name: row.name,
        setCode: row.setCode,
        collectorNumber: row.collectorNumber,
        finish: row.finish,
        condition: row.condition,
        language: row.language,
        quantity: 1,
        priceCents: row.priceCents,
        imageUri: row.imageUri,
        sourceRow: row.sourceRow,
        expansionIndex,
      });
    }
  }

  return units;
}

export async function parseManaboxCsv(
  raw: string,
): Promise<{ rows: ParsedManaboxRow[]; errors: string[] }> {
  const table = parseCsvRows(raw);
  if (table.length < 2) {
    return { rows: [], errors: ["CSV must include a header row and at least one data row"] };
  }

  const headers = table[0].map(normalizeHeader);
  const rows: ParsedManaboxRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < table.length; i++) {
    const sourceRow = i + 1;
    const record = rowToRecord(headers, table[i]);

    const name = record.name?.trim();
    const setCode = (record.setCode ?? "").trim().toLowerCase();
    const scryfallId = record.scryfallId?.trim() || null;
    const quantity = Number.parseInt(record.quantity ?? "1", 10);

    if (!name && !scryfallId) {
      errors.push(`Row ${sourceRow}: missing card name and Scryfall ID`);
      continue;
    }

    if (!setCode && !scryfallId) {
      errors.push(`Row ${sourceRow}: missing set code`);
      continue;
    }

    if (!Number.isFinite(quantity) || quantity < 1) {
      errors.push(`Row ${sourceRow}: invalid quantity`);
      continue;
    }

    const condition = mapCondition(record.condition ?? "");
    if (!condition) {
      errors.push(`Row ${sourceRow}: unrecognized condition "${record.condition}"`);
      continue;
    }

    rows.push({
      scryfallId,
      name: name || "Unknown",
      setCode: setCode || "unknown",
      collectorNumber: record.collectorNumber?.trim() || null,
      finish: mapFinish(record.foil ?? "", record.finish ?? ""),
      condition,
      language: mapLanguage(record.language ?? ""),
      quantity,
      priceCents: null,
      imageUri: null,
      sourceRow,
    });
  }

  const enriched: ParsedManaboxRow[] = [];
  for (const row of rows) {
    enriched.push(await enrichRow(row));
  }

  return { rows: enriched, errors };
}
