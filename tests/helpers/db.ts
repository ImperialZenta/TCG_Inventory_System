import { db } from "@/lib/db";

const TRUNCATE_TABLES = [
  "Session",
  "OrganizationMembership",
  "User",
  "Organization",
  "PickHistory",
  "PickItem",
  "PickWave",
  "ExternalOrderLine",
  "ExternalOrder",
  "PickList",
  "CardLine",
  "InventoryEvent",
  "StagingCard",
  "StagingImport",
  "Block",
  "Bin",
  "Shelf",
  "BlockSequence",
  "BinSequence",
  "PickListSequence",
  "AppSetting",
  "Language",
] as const;

/**
 * Wipe inventory tables and re-seed minimal reference data for formalize tests.
 */
export async function resetTestDb(): Promise<{ binId: string }> {
  const quoted = TRUNCATE_TABLES.map((t) => `"${t}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);

  await db.blockSequence.create({
    data: { id: "mtg", nextNum: 1, prefix: "MTG" },
  });
  await db.binSequence.create({
    data: { id: "default", nextNum: 1 },
  });
  await db.pickListSequence.create({
    data: { id: "pick", nextNum: 1, prefix: "PICK" },
  });
  await db.appSetting.create({
    data: { key: "default_staging_target_count", value: "50" },
  });

  await db.organization.create({
    data: { slug: "default", name: "Test Shop" },
  });

  const shelf = await db.shelf.create({
    data: { code: "TEST-A", label: "Test shelf", sortOrder: 1 },
  });

  const bin = await db.bin.create({
    data: {
      binId: "TEST-A-B01",
      shelfId: shelf.id,
      label: "Test bin",
      sortOrder: 1,
    },
  });

  return { binId: bin.id };
}

export async function disconnectTestDb(): Promise<void> {
  await db.$disconnect();
}
