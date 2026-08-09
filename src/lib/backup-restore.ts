import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type {
  BackupBin,
  BackupBlock,
  BackupCardLine,
  BackupShelf,
  BackupStagingCard,
  BackupStagingImport,
  BackupSummary,
} from "@/lib/backup-types";
import { centsFromUsd } from "@/lib/money";
import { parseBackupJson, summarizeBackup } from "@/lib/backup-parse";
import { wipeAllForRestore } from "@/lib/data-reset";

export { BackupValidationError, parseBackupJson, summarizeBackup } from "@/lib/backup-parse";

type TransactionClient = Prisma.TransactionClient;

function shelfData(shelf: BackupShelf) {
  return {
    id: shelf.id,
    code: shelf.code,
    label: shelf.label,
    sortOrder: shelf.sortOrder,
    createdAt: shelf.createdAt,
    updatedAt: shelf.updatedAt,
  };
}

function binData(bin: BackupBin) {
  return {
    id: bin.id,
    binId: bin.binId,
    shelfId: bin.shelfId,
    label: bin.label,
    sortOrder: bin.sortOrder,
    createdAt: bin.createdAt,
    updatedAt: bin.updatedAt,
  };
}

function blockData(block: BackupBlock) {
  return {
    id: block.id,
    blockId: block.blockId,
    label: block.label,
    status: block.status as Prisma.EnumBlockStatusFieldUpdateOperationsInput["set"],
    tier: block.tier as Prisma.EnumBlockTierFieldUpdateOperationsInput["set"],
    channel: block.channel as Prisma.EnumBlockChannelFieldUpdateOperationsInput["set"],
    binId: block.binId,
    packedAt: block.packedAt,
    sealedAt: block.sealedAt,
    lastPickAt: block.lastPickAt,
    activatedAt: block.activatedAt,
    targetCount: block.targetCount,
    notes: block.notes,
    createdAt: block.createdAt,
    updatedAt: block.updatedAt,
  };
}

function cardLineNestedData(card: BackupCardLine, fallbackPosition: number) {
  return {
    id: card.id,
    scryfallId: card.scryfallId,
    name: card.name,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    finish: card.finish as Prisma.EnumFinishFieldUpdateOperationsInput["set"],
    language: card.language,
    condition: card.condition as Prisma.EnumConditionFieldUpdateOperationsInput["set"],
    quantity: card.quantity,
    position: card.position ?? fallbackPosition,
    isBulkLine: card.isBulkLine,
    bulkDescription: card.bulkDescription,
    priceCents:
      card.priceCents ??
      (card.priceUsd != null ? centsFromUsd(card.priceUsd) : null),
    imageUri: card.imageUri,
    addedAt: card.addedAt,
  };
}

function stagingCardNestedData(card: BackupStagingCard) {
  return {
    id: card.id,
    scryfallId: card.scryfallId,
    name: card.name,
    setCode: card.setCode,
    collectorNumber: card.collectorNumber,
    finish: card.finish as Prisma.EnumFinishFieldUpdateOperationsInput["set"],
    language: card.language,
    condition: card.condition as Prisma.EnumConditionFieldUpdateOperationsInput["set"],
    quantity: card.quantity,
    position: card.position ?? null,
    expansionIndex: card.expansionIndex ?? null,
    suggestedBlock: card.suggestedBlock,
    assignedBlockId: card.assignedBlockId,
    sourceRow: card.sourceRow,
    priceCents: card.priceCents ?? null,
    imageUri: card.imageUri ?? null,
    createdAt: card.createdAt,
  };
}

function stagingImportData(stagingImport: BackupStagingImport) {
  return {
    id: stagingImport.id,
    filename: stagingImport.filename,
    rowCount: stagingImport.rowCount,
    status: stagingImport.status as Prisma.EnumStagingImportStatusFieldUpdateOperationsInput["set"],
    targetCount: stagingImport.targetCount,
    createdAt: stagingImport.createdAt,
  };
}

function nextBlockSequenceNum(blocks: BackupBlock[]): number {
  let max = 0;
  for (const block of blocks) {
    const match = block.blockId.match(/^MTG-(\d+)$/);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return max + 1;
}

async function restoreSequences(tx: TransactionClient, blocks: BackupBlock[], binCount: number) {
  const nextBlockNum = nextBlockSequenceNum(blocks);
  await tx.blockSequence.upsert({
    where: { id: "mtg" },
    update: { nextNum: nextBlockNum },
    create: { id: "mtg", nextNum: nextBlockNum, prefix: "MTG" },
  });
  await tx.pickListSequence.upsert({
    where: { id: "pick" },
    update: { nextNum: 1 },
    create: { id: "pick", nextNum: 1, prefix: "PICK" },
  });
  await tx.binSequence.upsert({
    where: { id: "default" },
    update: { nextNum: Math.max(1, binCount + 1) },
    create: { id: "default", nextNum: Math.max(1, binCount + 1) },
  });
}

async function restoreBackupInTransaction(
  tx: TransactionClient,
  backup: ReturnType<typeof parseBackupJson>,
) {
  await wipeAllForRestore(tx);

  for (const language of backup.languages) {
    await tx.language.upsert({
      where: { scryfallCode: language.scryfallCode },
      update: {
        manapoolCode: language.manapoolCode,
        label: language.label,
        localOnly: language.localOnly,
      },
      create: language,
    });
  }

  for (const shelf of backup.shelves) {
    await tx.shelf.create({ data: shelfData(shelf) });
  }

  for (const bin of backup.bins) {
    await tx.bin.create({ data: binData(bin) });
  }

  for (const block of backup.blocks) {
    await tx.block.create({
      data: {
        ...blockData(block),
        cards: {
          create: block.cards.map((card, index) => cardLineNestedData(card, index + 1)),
        },
      },
    });
  }

  for (const stagingImport of backup.stagingImports) {
    await tx.stagingImport.create({
      data: {
        ...stagingImportData(stagingImport),
        cards: {
          create: stagingImport.cards.map((card) => stagingCardNestedData(card)),
        },
      },
    });
  }

  for (const setting of backup.settings) {
    await tx.appSetting.create({ data: setting });
  }

  await restoreSequences(tx, backup.blocks, backup.bins.length);
}

export async function restoreInventoryBackup(raw: string): Promise<BackupSummary> {
  const backup = parseBackupJson(raw);
  const summary = summarizeBackup(backup);

  await db.$transaction(
    async (tx) => {
      await restoreBackupInTransaction(tx, backup);
    },
    { timeout: 120_000 },
  );

  return summary;
}
