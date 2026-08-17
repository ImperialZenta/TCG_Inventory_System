import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { requirePermission, PERMISSIONS } from "@/lib/auth/permissions";

type TransactionClient = Prisma.TransactionClient;

async function resetBlockSequences(tx: TransactionClient) {
  await tx.blockSequence.upsert({
    where: { id: "mtg" },
    update: { nextNum: 1 },
    create: { id: "mtg", nextNum: 1, prefix: "MTG" },
  });
  await tx.pickListSequence.upsert({
    where: { id: "pick" },
    update: { nextNum: 1 },
    create: { id: "pick", nextNum: 1, prefix: "PICK" },
  });
  await tx.uploadSessionSequence.upsert({
    where: { id: "upload" },
    update: { nextNum: 1 },
    create: { id: "upload", nextNum: 1, prefix: "UP" },
  });
}

async function resetBinSequence(tx: TransactionClient) {
  await tx.binSequence.upsert({
    where: { id: "default" },
    update: { nextNum: 1 },
    create: { id: "default", nextNum: 1 },
  });
}

/** Removes blocks, cards, staging, orders, picks, stock, and audit logs. Keeps shelves and bins. */
export async function deleteOperationalInventory(tx: TransactionClient) {
  await tx.pickItem.deleteMany();
  await tx.pickWave.deleteMany();
  await tx.externalOrderLine.deleteMany();
  await tx.externalOrder.deleteMany();
  await tx.pickList.deleteMany();
  // Stock ledger: domain mutations are append-only (ADR-004). Bulk delete only via danger zone.
  await tx.stockMovement.deleteMany();
  await tx.stockReservation.deleteMany();
  await tx.stockItem.deleteMany();
  await tx.inventoryEvent.deleteMany();
  await tx.uploadExportAudit.deleteMany();
  await tx.uploadSessionBlock.deleteMany();
  await tx.uploadSession.deleteMany();
  await tx.channelCatalogBin.deleteMany();
  await tx.channelCatalog.deleteMany();
  await tx.stagingImport.deleteMany();
  await tx.block.deleteMany();
  await resetBlockSequences(tx);
}

export async function deleteAllCardInventory(ctx: DomainContext) {
  await requirePermission(ctx, PERMISSIONS.DANGER_ZONE);
  await db.$transaction(deleteOperationalInventory);
}

export async function deleteAllBins(ctx: DomainContext) {
  await requirePermission(ctx, PERMISSIONS.DANGER_ZONE);
  await db.$transaction(async (tx) => {
    await deleteOperationalInventory(tx);
    await tx.bin.deleteMany();
  });
}

export async function deleteAllShelves(ctx: DomainContext) {
  await requirePermission(ctx, PERMISSIONS.DANGER_ZONE);
  await db.$transaction(async (tx) => {
    await tx.bin.updateMany({ data: { shelfId: null } });
    await tx.shelf.deleteMany();
  });
}

/** Wipes all inventory and settings before a full restore. Keeps language table until upserted from backup. */
export async function wipeAllForRestore(tx: TransactionClient) {
  await tx.pickItem.deleteMany();
  await tx.pickWave.deleteMany();
  await tx.externalOrderLine.deleteMany();
  await tx.externalOrder.deleteMany();
  await tx.pickList.deleteMany();
  await tx.stockMovement.deleteMany();
  await tx.stockReservation.deleteMany();
  await tx.stockItem.deleteMany();
  await tx.inventoryEvent.deleteMany();
  await tx.uploadExportAudit.deleteMany();
  await tx.uploadSessionBlock.deleteMany();
  await tx.uploadSession.deleteMany();
  await tx.channelCatalogBin.deleteMany();
  await tx.channelCatalog.deleteMany();
  await tx.stagingImport.deleteMany();
  await tx.block.deleteMany();
  await tx.bin.deleteMany();
  await tx.shelf.deleteMany();
  await tx.appSetting.deleteMany();
}

export async function deleteAllInventoryData(ctx: DomainContext) {
  await requirePermission(ctx, PERMISSIONS.DANGER_ZONE);
  await db.$transaction(async (tx) => {
    await wipeAllForRestore(tx);
    await resetBlockSequences(tx);
    await resetBinSequence(tx);
  });
}
