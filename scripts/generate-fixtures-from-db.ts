/**
 * Sample ACTIVE inventory into order + pullsheet fixtures for manual pick smoke.
 *
 *   DATABASE_URL=postgresql://tcg:tcg@localhost:5432/tcg_inventory npx tsx scripts/generate-fixtures-from-db.ts
 *
 * Optional:
 *   COUNT=16
 *   FIXTURE_OUT_DIR=docs/fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { CONDITION_LABELS, FINISH_LABELS } from "../src/lib/constants";

const MIN_COUNT = 12;
const DEFAULT_COUNT = 16;

type SampledCard = {
  id: string;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  condition: keyof typeof CONDITION_LABELS;
  finish: keyof typeof FINISH_LABELS;
  language: string;
  scryfallId: string | null;
  blockId: string;
  position: number;
};

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Round-robin across blocks so the pick list spans multiple bricks. */
function stratifiedSample(cards: SampledCard[], count: number): SampledCard[] {
  const byBlock = new Map<string, SampledCard[]>();
  for (const card of cards) {
    const list = byBlock.get(card.blockId) ?? [];
    list.push(card);
    byBlock.set(card.blockId, list);
  }

  for (const list of byBlock.values()) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
  }

  const blockIds = [...byBlock.keys()].sort();
  const selected: SampledCard[] = [];
  const seen = new Set<string>();
  let round = 0;

  while (selected.length < count) {
    let addedThisRound = false;
    for (const blockId of blockIds) {
      const list = byBlock.get(blockId) ?? [];
      const card = list[round];
      if (!card || seen.has(card.id)) continue;
      seen.add(card.id);
      selected.push(card);
      addedThisRound = true;
      if (selected.length >= count) break;
    }
    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

async function main() {
  const count = Math.max(
    MIN_COUNT,
    Number.parseInt(process.env.COUNT ?? String(DEFAULT_COUNT), 10) || DEFAULT_COUNT,
  );
  const outDir = path.resolve(process.env.FIXTURE_OUT_DIR ?? "docs/fixtures");

  const rows = await db.cardLine.findMany({
    where: {
      quantity: { gt: 0 },
      block: { status: "ACTIVE" },
    },
    select: {
      id: true,
      name: true,
      setCode: true,
      collectorNumber: true,
      condition: true,
      finish: true,
      language: true,
      scryfallId: true,
      position: true,
      block: { select: { blockId: true } },
    },
  });

  if (rows.length < MIN_COUNT) {
    throw new Error(
      `Need at least ${MIN_COUNT} ACTIVE card lines; found ${rows.length}. Restore a DB with Active blocks first.`,
    );
  }

  const pool: SampledCard[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    setCode: r.setCode,
    collectorNumber: r.collectorNumber,
    condition: r.condition,
    finish: r.finish,
    language: r.language,
    scryfallId: r.scryfallId,
    blockId: r.block.blockId,
    position: r.position,
  }));

  const sample = stratifiedSample(pool, Math.min(count, pool.length));
  if (sample.length < MIN_COUNT) {
    throw new Error(`Stratified sample produced only ${sample.length} cards`);
  }

  const orderFixture = {
    orders: [
      {
        id: "mp-fixture-db-001",
        reference: "TEST-ORDER-DB-001",
        lines: sample.map((card, index) => ({
          id: `line-db-${index + 1}`,
          name: card.name,
          setCode: card.setCode,
          collectorNumber: card.collectorNumber ?? undefined,
          condition: card.condition,
          finish: card.finish,
          language: card.language,
          quantity: 1,
          ...(card.scryfallId ? { scryfallId: card.scryfallId } : {}),
          priceCents: 100 + index * 25,
        })),
      },
    ],
  };

  const pullsheetHeader = "Product Name,Set Name,Condition,Quantity,Printing";
  const pullsheetRows = sample.map((card) => {
    const conditionLabel = CONDITION_LABELS[card.condition] ?? card.condition;
    const printing = card.finish === "NONFOIL" ? "Normal" : FINISH_LABELS[card.finish] ?? card.finish;
    const setName = `${card.setCode} (${card.setCode})`;
    return [
      csvEscape(card.name),
      csvEscape(setName),
      csvEscape(conditionLabel),
      "1",
      csvEscape(printing),
    ].join(",");
  });

  await mkdir(outDir, { recursive: true });

  const orderPath = path.join(outDir, "manapool-order-from-db.json");
  const pullsheetPath = path.join(outDir, "tcgplayer-pullsheet-from-db.csv");

  await writeFile(orderPath, `${JSON.stringify(orderFixture, null, 2)}\n`, "utf8");
  await writeFile(pullsheetPath, `${pullsheetHeader}\n${pullsheetRows.join("\n")}\n`, "utf8");

  const byBlock = new Map<string, number>();
  for (const card of sample) {
    byBlock.set(card.blockId, (byBlock.get(card.blockId) ?? 0) + 1);
  }

  console.log(`Wrote ${sample.length} lines → ${orderPath}`);
  console.log(`Wrote ${sample.length} lines → ${pullsheetPath}`);
  console.log(
    "Blocks:",
    [...byBlock.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, n]) => `${id}:${n}`)
      .join(", "),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
