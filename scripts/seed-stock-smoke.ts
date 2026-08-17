/**
 * Manual QA helper for SKU-009 stock browser smoke on dev (localhost:3010).
 *
 * Creates sorted stock via the real ledger (receiveStock), not raw SQL.
 *
 * Run inside Docker:
 *   docker compose exec app npm run seed:stock-smoke
 *
 * Or on the host (Postgres exposed on 5432):
 *   $env:DATABASE_URL="postgresql://tcg:tcg@localhost:5432/tcg_inventory"
 *   npm run seed:stock-smoke
 *
 * Optional args: quantity (default 5), e.g. npm run seed:stock-smoke -- 3
 */
import { db } from "../src/lib/db";
import { TEST_OWNER_CONTEXT } from "../src/lib/context/domain-context";
import { findStockItemByIdentity, receiveStock, type StockIdentity } from "../src/lib/stock";

const SMOKE_BOLT: StockIdentity = {
  scryfallId: "smoke-bolt-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL",
  language: "en",
  condition: "NM",
};

function parseQuantity(): number {
  const raw = process.argv[2]?.trim();
  if (!raw) return 5;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n <= 0) {
    console.error("Quantity must be a positive integer");
    process.exit(1);
  }
  return n;
}

async function main() {
  const targetQty = parseQuantity();

  const bin = await db.bin.findFirst({
    include: { shelf: true },
  });

  if (!bin) {
    console.error("No bin found — run npm run db:seed first");
    process.exit(1);
  }

  const locationLabel = bin.shelf
    ? `${bin.shelf.code} · ${bin.binId}`
    : bin.binId;

  const existing = await findStockItemByIdentity(SMOKE_BOLT);
  if (existing && existing.onHandQuantity >= targetQty) {
    console.log(
      `Stock smoke data already present: ${existing.name} on-hand ${existing.onHandQuantity} (${existing.id})`,
    );
    console.log(`Location: ${locationLabel}`);
    console.log(`Open http://localhost:3010/stock`);
    return;
  }

  const receiveQty = existing ? targetQty - existing.onHandQuantity : targetQty;

  const result = await receiveStock(TEST_OWNER_CONTEXT, SMOKE_BOLT, receiveQty, {
    binId: bin.id,
    marketPriceCents: 199,
    referenceType: "smoke",
    referenceId: "seed-stock-smoke",
  });

  console.log(`Seeded ${SMOKE_BOLT.name} — on-hand ${result.onHandAfter} (${result.stockItem.id})`);
  console.log(`Location: ${locationLabel}`);
  console.log(`Movement: ${result.movementId} (RECEIVE +${receiveQty})`);
  console.log(`Open http://localhost:3010/stock`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
