import type { Condition, Finish } from "@prisma/client";

export interface TcgplayerPullsheetRow {
  name: string;
  setCode: string | null;
  setName: string | null;
  condition: Condition;
  finish: Finish;
  language: string;
  quantity: number;
  productLine: string | null;
  collectorNumber: string | null;
}

export interface ParsePullsheetResult {
  lines: TcgplayerPullsheetRow[];
  errors: string[];
}

const CONDITION_MAP: Record<string, Condition> = {
  near: "NM",
  nm: "NM",
  "near mint": "NM",
  lightly: "LP",
  lp: "LP",
  "lightly played": "LP",
  moderately: "MP",
  mp: "MP",
  "moderately played": "MP",
  heavily: "HP",
  hp: "HP",
  "heavily played": "HP",
  damaged: "DMG",
  dmg: "DMG",
};

function parseCondition(raw: string): Condition {
  const key = raw.trim().toLowerCase();
  return CONDITION_MAP[key] ?? "NM";
}

function parseFinish(raw: string, name: string): Finish {
  const combined = `${raw} ${name}`.toLowerCase();
  if (combined.includes("etched")) return "ETCHED";
  if (combined.includes("foil")) return "FOIL";
  return "NONFOIL";
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function findColumn(headers: string[], ...candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function setCodeFromSetName(setName: string): string | null {
  const trimmed = setName.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/\(([a-z0-9]+)\)/i);
  if (match) return match[1]!.toLowerCase();
  return trimmed.slice(0, 5).toLowerCase().replace(/\s+/g, "");
}

export function parseTcgplayerPullsheetCsv(csvText: string): ParsePullsheetResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];

  if (lines.length < 2) {
    return { lines: [], errors: ["CSV must have a header row and at least one data row"] };
  }

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);
  const nameIdx = findColumn(headers, "product name", "name", "title");
  const setIdx = findColumn(headers, "set name", "set", "expansion");
  const condIdx = findColumn(headers, "condition");
  const qtyIdx = findColumn(headers, "quantity", "qty");
  const finishIdx = findColumn(headers, "printing", "finish", "foil");
  const langIdx = findColumn(headers, "language", "lang");
  const productLineIdx = findColumn(headers, "product line", "game");
  const numberIdx = findColumn(headers, "number", "collector");

  if (nameIdx < 0) {
    return { lines: [], errors: ["Could not find Product Name column"] };
  }

  const rows: TcgplayerPullsheetRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]!);
    const name = fields[nameIdx]?.trim();
    if (!name) continue;

    const setName = setIdx >= 0 ? fields[setIdx]?.trim() ?? null : null;
    const conditionRaw = condIdx >= 0 ? fields[condIdx]?.trim() ?? "Near Mint" : "Near Mint";
    const finishRaw = finishIdx >= 0 ? fields[finishIdx]?.trim() ?? "" : "";
    const qtyRaw = qtyIdx >= 0 ? fields[qtyIdx]?.trim() ?? "1" : "1";
    const qty = parseInt(qtyRaw, 10);

    if (Number.isNaN(qty) || qty < 1) {
      errors.push(`Row ${i + 1}: invalid quantity "${qtyRaw}"`);
      continue;
    }

    rows.push({
      name,
      setCode: setName ? setCodeFromSetName(setName) : null,
      setName,
      condition: parseCondition(conditionRaw),
      finish: parseFinish(finishRaw, name),
      language: langIdx >= 0 ? (fields[langIdx]?.trim().toLowerCase() || "en") : "en",
      quantity: qty,
      productLine: productLineIdx >= 0 ? fields[productLineIdx]?.trim() ?? null : null,
      collectorNumber: numberIdx >= 0 ? fields[numberIdx]?.trim() ?? null : null,
    });
  }

  return { lines: rows, errors };
}

export function pullsheetRowsToPickLines(rows: TcgplayerPullsheetRow[]) {
  return rows.map((row) => ({
    name: row.name,
    setCode: row.setCode,
    condition: row.condition,
    finish: row.finish,
    language: row.language,
    quantity: row.quantity,
  }));
}
