import type { CardLine } from "@prisma/client";
import { FINISH_TO_MANAPOOL } from "@/lib/languages";

export interface ManaPoolCsvRow {
  scryfallId: string;
  language: string;
  finish: string;
  condition: string;
  quantity: number;
  name: string;
  setCode: string;
}

/** Aggregate card lines by identity for Mana Pool listing export. */
export function aggregateCardLinesForListing(
  lines: CardLine[],
): ManaPoolCsvRow[] {
  const map = new Map<string, ManaPoolCsvRow>();

  for (const line of lines) {
    if (line.isBulkLine || !line.scryfallId) continue;

    const key = `${line.scryfallId}|${line.condition}|${line.finish}|${line.language}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      map.set(key, {
        scryfallId: line.scryfallId,
        language: line.language,
        finish: FINISH_TO_MANAPOOL[line.finish] ?? "NF",
        condition: line.condition,
        quantity: line.quantity,
        name: line.name,
        setCode: line.setCode,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Mana Pool / ManaBox compatible CSV (quantity filled; user edits prices). */
export function toManaPoolCsv(rows: ManaPoolCsvRow[]): string {
  const header = [
    "Scryfall ID",
    "Name",
    "Set code",
    "Language",
    "Condition",
    "Finish",
    "Quantity",
    "My Store Price",
  ];

  const body = rows.map((r) =>
    [
      r.scryfallId,
      `"${r.name.replace(/"/g, '""')}"`,
      r.setCode,
      r.language,
      r.condition,
      r.finish,
      r.quantity,
      "",
    ].join(","),
  );

  return [header.join(","), ...body].join("\n");
}
