import { db } from "@/lib/db";

const TRUNCATE_TABLES = [
  "Session",
  "OrganizationMembership",
  "User",
  "Organization",
  "OversellIncidentOrder",
  "OversellIncident",
  "ChannelOutbox",
  "ChannelListing",
  "Channel",
  "PickHistory",
  "PickItem",
  "PickWave",
  "ExternalOrderLine",
  "ExternalOrder",
  "PickList",
  "CardLine",
  "StockMovement",
  "StockReservation",
  "StockItem",
  "InventoryEvent",
  "UploadExportAudit",
  "UploadSessionBlock",
  "UploadSession",
  "ChannelCatalogBin",
  "ChannelCatalog",
  "StagingCard",
  "StagingImport",
  "Block",
  "Bin",
  "Shelf",
  "BlockSequence",
  "BinSequence",
  "PickListSequence",
  "UploadSessionSequence",
  "AppSetting",
  "Language",
] as const;

const RESET_LOCK_KEY = "tcg_inventory_test_reset";
const LOCK_RETRY_MS = 200;
const MAX_LOCK_WAIT_MS = 90_000;
const RESET_TX_TIMEOUT_MS = 90_000;

async function ensureDbConnected(): Promise<void> {
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    await db.$connect();
  }
}

async function acquireResetLock(): Promise<void> {
  const deadline = Date.now() + MAX_LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    const rows = await db.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_lock(hashtext(${RESET_LOCK_KEY})) AS acquired
    `;
    if (rows[0]?.acquired) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
  }
  throw new Error(
    "Timed out waiting for test DB reset lock. Another `docker compose --profile test run` may be using tcg_inventory_test.",
  );
}

async function releaseResetLock(): Promise<void> {
  await db.$executeRaw`SELECT pg_advisory_unlock(hashtext(${RESET_LOCK_KEY}))`;
}

/**
 * Wipe inventory tables and re-seed minimal reference data for formalize tests.
 * Advisory lock serializes resets when multiple compose test runs share tcg_inventory_test.
 */
export async function resetTestDb(): Promise<{ binId: string }> {
  await ensureDbConnected();
  await acquireResetLock();
  try {
    return await db.$transaction(
      async (tx) => {
        const quoted = TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ");
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

        await tx.blockSequence.create({
          data: { id: "mtg", nextNum: 1, prefix: "MTG" },
        });
        await tx.binSequence.create({
          data: { id: "default", nextNum: 1 },
        });
        await tx.pickListSequence.create({
          data: { id: "pick", nextNum: 1, prefix: "PICK" },
        });
        await tx.uploadSessionSequence.create({
          data: { id: "upload", nextNum: 1, prefix: "UP" },
        });
        await tx.appSetting.create({
          data: { key: "default_staging_target_count", value: "50" },
        });

        await tx.organization.create({
          data: { slug: "default", name: "Test Shop" },
        });

        const shelf = await tx.shelf.create({
          data: { code: "TEST-A", label: "Test shelf", sortOrder: 1 },
        });

        const bin = await tx.bin.create({
          data: {
            binId: "TEST-A-B01",
            shelfId: shelf.id,
            label: "Test bin",
            sortOrder: 1,
          },
        });

        return { binId: bin.id };
      },
      { timeout: RESET_TX_TIMEOUT_MS },
    );
  } finally {
    await releaseResetLock();
  }
}

/**
 * No-op during the suite — globalTeardown disconnects Prisma once.
 * Per-file afterAll hooks may still call this safely.
 */
export async function disconnectTestDb(): Promise<void> {
  // See tests/global-teardown.ts
}
