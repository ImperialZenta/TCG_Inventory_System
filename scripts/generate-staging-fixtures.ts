/**
 * Slice the committed ManaBox export into sequenced staging fixtures, plus the
 * order and pullsheet fixtures that match the blocks those slices create.
 *
 *   npm run fixtures:staging
 *
 * Every card row is copied verbatim from docs/fixtures/source/manabox-dax-250.csv.
 * Nothing here invents cards: slices name real rows, and the script fails loudly
 * if a named row is missing or claimed by two slices.
 *
 * Optional env:
 *   FIXTURE_SOURCE  path to the source CSV
 *   FIXTURE_OUT_DIR output directory (default docs/fixtures)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_SOURCE = "docs/fixtures/source/manabox-dax-250.csv";
const DEFAULT_OUT_DIR = "docs/fixtures";

interface SourceRow {
  /** Verbatim line from the source CSV. */
  raw: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  quantity: number;
  scryfallId: string;
  purchasePrice: number;
}

/** `Name|SET|collectorNumber`, exactly as written in the source CSV. */
type CardKey = string;

function cardKey(name: string, setCode: string, collectorNumber: string): CardKey {
  return `${name}|${setCode}|${collectorNumber}`;
}

interface SliceSpec {
  file: string;
  purpose: string;
  /** Rows named explicitly, in the order they should appear. */
  cards?: CardKey[];
  /** Fill from unused rows instead of naming each one. */
  autoFill?: { count: number; quantity: number };
}

const SLICES: SliceSpec[] = [
  {
    file: "staging-01-single-block.csv",
    purpose: "12 single-copy cards — one block, baseline intake and the source of the pick fixtures",
    cards: [
      "Leaping Lizard|HML|90",
      "Illusionary Terrain|ICE|77",
      "Midnight Recovery|GTC|73",
      "Fallen Angel|BTD|25",
      "Kheru Dreadmaw|KTK|76",
      "Disowned Ancestor|KTK|70",
      "Ainok Tracker|KTK|96",
      "Bloodfire Expert|KTK|101",
      "Tusked Colossodon|KTK|155",
      "Waterwhirl|KTK|60",
      "Crackling Triton|THS|45",
      "Griptide|THS|50",
    ],
  },
  {
    file: "staging-02-two-blocks.csv",
    purpose: "20 single-copy cards — two blocks at target count 10, per-block bin assignment",
    autoFill: { count: 20, quantity: 1 },
  },
  {
    file: "staging-03-qty-split.csv",
    purpose: "24 units from 6 rows — at target count 8 a quantity group straddles a block boundary",
    cards: [
      "Snow Devil|ICE|100",
      "Zuran Enchanter|ICE|111",
      "Kelsinko Ranger|ICE|33",
      "Legions of Lim-Dûl|ICE|142",
      "Weakness|3ED|136",
      "Torture|HML|59a",
    ],
  },
  {
    file: "staging-04-shelf-b.csv",
    purpose: "6 single-copy cards for a shelf B block — second wave in the pick order",
    cards: [
      "Sengir Autocrat|HML|56",
      "Ambush Party|HML|63a",
      "Anaba Bodyguard|HML|66b",
      "Vesper Ghoul|DIS|57",
      "Rats' Feast|JUD|71",
      "Mindstab Thrull|5ED|178",
    ],
  },
  {
    file: "staging-05-undo.csv",
    purpose: "4 disposable cards — undo formalize, discard staging, delete staging",
    cards: [
      "Word of Binding|4ED|172",
      "Unholy Strength|4ED|166",
      "Murk Dwellers|4ED|148",
      "Frozen Shade|3ED|112",
    ],
  },
];

/**
 * Which staging-01 cards each pick fixture claims. They must not overlap: every
 * card in staging-01 is a single copy, so two fixtures wanting the same card
 * would make the second pick list short.
 */
const ORDER_CARDS = { slice: "staging-01-single-block.csv", from: 0, to: 4 };
const PULLSHEET_CARDS = { slice: "staging-01-single-block.csv", from: 4, to: 8 };
const WAVE_SHELF_A = { slice: "staging-01-single-block.csv", index: 8 };
const WAVE_SHELF_B = { slice: "staging-04-shelf-b.csv", index: 3 };

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

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function readSource(text: string): { header: string; rows: SourceRow[] } {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = lines[0]!;
  const columns = parseCsvLine(header).map((c) => c.trim().toLowerCase());

  const column = (name: string) => {
    const index = columns.indexOf(name);
    if (index < 0) throw new Error(`Source CSV is missing the "${name}" column`);
    return index;
  };

  const idx = {
    name: column("name"),
    setCode: column("set code"),
    setName: column("set name"),
    collectorNumber: column("collector number"),
    quantity: column("quantity"),
    scryfallId: column("scryfall id"),
    purchasePrice: column("purchase price"),
  };

  const rows = lines.slice(1).map((raw) => {
    const fields = parseCsvLine(raw).map((f) => f.trim());
    return {
      raw,
      name: fields[idx.name] ?? "",
      setCode: fields[idx.setCode] ?? "",
      setName: fields[idx.setName] ?? "",
      collectorNumber: fields[idx.collectorNumber] ?? "",
      quantity: Number.parseInt(fields[idx.quantity] ?? "1", 10) || 1,
      scryfallId: fields[idx.scryfallId] ?? "",
      purchasePrice: Number.parseFloat(fields[idx.purchasePrice] ?? "0") || 0,
    };
  });

  return { header, rows };
}

function buildSlices(rows: SourceRow[]): Map<string, SourceRow[]> {
  const byKey = new Map<CardKey, SourceRow>();
  for (const row of rows) {
    byKey.set(cardKey(row.name, row.setCode, row.collectorNumber), row);
  }

  const claimed = new Map<CardKey, string>();
  const slices = new Map<string, SourceRow[]>();

  for (const spec of SLICES) {
    if (!spec.cards) continue;

    const selected: SourceRow[] = [];
    for (const key of spec.cards) {
      const row = byKey.get(key);
      if (!row) {
        throw new Error(`${spec.file}: no source row for "${key}"`);
      }
      const owner = claimed.get(key);
      if (owner) {
        throw new Error(`${spec.file}: "${key}" is already used by ${owner}`);
      }
      claimed.set(key, spec.file);
      selected.push(row);
    }
    slices.set(spec.file, selected);
  }

  // Auto-filled slices take whatever is left, so they never collide with a named card.
  for (const spec of SLICES) {
    if (!spec.autoFill) continue;

    const selected: SourceRow[] = [];
    for (const row of rows) {
      if (selected.length >= spec.autoFill.count) break;
      const key = cardKey(row.name, row.setCode, row.collectorNumber);
      if (claimed.has(key)) continue;
      if (row.quantity !== spec.autoFill.quantity) continue;
      claimed.set(key, spec.file);
      selected.push(row);
    }

    if (selected.length < spec.autoFill.count) {
      throw new Error(
        `${spec.file}: needed ${spec.autoFill.count} unused quantity-${spec.autoFill.quantity} rows, found ${selected.length}`,
      );
    }
    slices.set(spec.file, selected);
  }

  return slices;
}

function pick(slices: Map<string, SourceRow[]>, file: string, index: number): SourceRow {
  const row = slices.get(file)?.[index];
  if (!row) throw new Error(`${file} has no row at index ${index}`);
  return row;
}

function orderLine(row: SourceRow, index: number) {
  return {
    id: `line-${index + 1}`,
    name: row.name,
    setCode: row.setCode.toLowerCase(),
    collectorNumber: row.collectorNumber,
    scryfallId: row.scryfallId,
    condition: "NM",
    finish: "NONFOIL",
    language: "en",
    quantity: 1,
    priceCents: Math.max(25, Math.round(row.purchasePrice * 100)),
  };
}

function orderFixture(id: string, reference: string, rows: SourceRow[]) {
  return {
    orders: [{ id, reference, lines: rows.map(orderLine) }],
  };
}

function pullsheetCsv(rows: SourceRow[]): string {
  const header = "Product Name,Set Name,Condition,Quantity,Printing";
  const body = rows.map((row) =>
    [
      csvEscape(row.name),
      csvEscape(`${row.setName} (${row.setCode.toLowerCase()})`),
      "Near Mint",
      "1",
      "Normal",
    ].join(","),
  );
  return `${header}\n${body.join("\n")}\n`;
}

async function main() {
  const sourcePath = path.resolve(process.env.FIXTURE_SOURCE ?? DEFAULT_SOURCE);
  const outDir = path.resolve(process.env.FIXTURE_OUT_DIR ?? DEFAULT_OUT_DIR);

  const { header, rows } = readSource(await readFile(sourcePath, "utf8"));
  const slices = buildSlices(rows);

  for (const spec of SLICES) {
    const selected = slices.get(spec.file)!;
    const units = selected.reduce((sum, row) => sum + row.quantity, 0);
    await writeFile(
      path.join(outDir, spec.file),
      `${header}\n${selected.map((r) => r.raw).join("\n")}\n`,
      "utf8",
    );
    console.log(`${spec.file}: ${selected.length} row(s), ${units} unit(s) — ${spec.purpose}`);
  }

  const orderRows = slices.get(ORDER_CARDS.slice)!.slice(ORDER_CARDS.from, ORDER_CARDS.to);
  const pullsheetRows = slices
    .get(PULLSHEET_CARDS.slice)!
    .slice(PULLSHEET_CARDS.from, PULLSHEET_CARDS.to);
  const waveRows = [
    pick(slices, WAVE_SHELF_A.slice, WAVE_SHELF_A.index),
    pick(slices, WAVE_SHELF_B.slice, WAVE_SHELF_B.index),
  ];

  const outputs: [string, string][] = [
    [
      "manapool-order-staging-01.json",
      `${JSON.stringify(orderFixture("mp-staging-001", "STAGE-ORDER-001", orderRows), null, 2)}\n`,
    ],
    [
      "manapool-order-staging-wave.json",
      `${JSON.stringify(orderFixture("mp-staging-wave-001", "STAGE-WAVE-001", waveRows), null, 2)}\n`,
    ],
    ["tcgplayer-pullsheet-staging-01.csv", pullsheetCsv(pullsheetRows)],
  ];

  for (const [file, contents] of outputs) {
    await writeFile(path.join(outDir, file), contents, "utf8");
    console.log(`${file}: written`);
  }

  console.log(`\nOrder lines:     ${orderRows.map((r) => r.name).join(", ")}`);
  console.log(`Pullsheet lines: ${pullsheetRows.map((r) => r.name).join(", ")}`);
  console.log(`Wave lines:      ${waveRows.map((r) => r.name).join(", ")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
