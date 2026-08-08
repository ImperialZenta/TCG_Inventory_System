import { db } from "@/lib/db";
import { formalizeStagingImport } from "@/lib/staging/formalize";
import { importExternalOrder } from "@/lib/orders/import-order";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import type { ImportedOrderDTO } from "@/lib/orders/types";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { transitionBlockStatus } from "@/lib/blocks/lifecycle";

export interface FormalizedImportFixture {
  importId: string;
  binId: string;
  blockCount: number;
  /** Human MTG IDs (e.g. MTG-0001) */
  blockIds: string[];
  /** Internal cuid IDs */
  internalIds: string[];
}

/**
 * Create a PARSED staging import with `blockCount` suggested blocks (2 cards each).
 */
export async function createMultiBlockImport(
  blockCount = 3,
  options?: { filename?: string; targetCount?: number },
): Promise<{ importId: string }> {
  const cards: {
    name: string;
    setCode: string;
    quantity: number;
    position: number;
    suggestedBlock: number;
    condition: "NM";
    finish: "NONFOIL";
    language: string;
  }[] = [];

  for (let block = 1; block <= blockCount; block++) {
    for (let pos = 1; pos <= 2; pos++) {
      cards.push({
        name: `Test Card B${block}-P${pos}`,
        setCode: "tst",
        quantity: 1,
        position: pos,
        suggestedBlock: block,
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      });
    }
  }

  const stagingImport = await db.stagingImport.create({
    data: {
      filename: options?.filename ?? `test-import-${blockCount}.csv`,
      rowCount: cards.length,
      status: "PARSED",
      targetCount: options?.targetCount ?? 2,
      cards: { create: cards },
    },
  });

  return { importId: stagingImport.id };
}

/**
 * Formalize a staging import into OPEN blocks in the given bin.
 */
export async function formalizeImport(
  importId: string,
  binId: string,
  blockCount: number,
): Promise<{ blockIds: string[]; internalIds: string[] }> {
  const binAssignments: Record<number, string> = {};
  for (let i = 1; i <= blockCount; i++) {
    binAssignments[i] = binId;
  }

  const blockIds = await formalizeStagingImport(importId, binAssignments);

  const blocks = await db.block.findMany({
    where: { blockId: { in: blockIds } },
    select: { id: true, blockId: true },
    orderBy: { blockId: "asc" },
  });

  return {
    blockIds: blocks.map((b) => b.blockId),
    internalIds: blocks.map((b) => b.id),
  };
}

/**
 * Create + formalize a multi-block import in one step.
 */
export async function createFormalizedImport(
  binId: string,
  blockCount = 3,
): Promise<FormalizedImportFixture> {
  const { importId } = await createMultiBlockImport(blockCount);
  const { blockIds, internalIds } = await formalizeImport(importId, binId, blockCount);
  return { importId, binId, blockCount, blockIds, internalIds };
}

/**
 * Attach a PickItem to the first card line of a block (by human MTG ID).
 */
export async function seedPickItemForBlock(blockId: string): Promise<{ pickItemId: string }> {
  const block = await db.block.findUnique({
    where: { blockId },
    include: { cards: { take: 1, orderBy: { position: "asc" } } },
  });

  if (!block) {
    throw new Error(`Block not found: ${blockId}`);
  }

  const cardLine = block.cards[0];
  if (!cardLine) {
    throw new Error(`Block ${blockId} has no card lines`);
  }

  let pickList = await db.pickList.findFirst({ where: { status: "OPEN" } });
  if (!pickList) {
    pickList = await db.pickList.create({
      data: { pickListId: `PL-TEST-${Date.now()}`, status: "OPEN" },
    });
  }

  const item = await db.pickItem.create({
    data: {
      pickListId: pickList.id,
      cardLineId: cardLine.id,
      blockId: block.id,
      quantity: 1,
      status: "PENDING",
    },
  });

  return { pickItemId: item.id };
}

/** Import a test order whose line names match createMultiBlockImport cards. */
export async function createTestExternalOrder(
  options?: Partial<ImportedOrderDTO>,
): Promise<{ externalOrderId: string; manapoolOrderId: string }> {
  const order: ImportedOrderDTO = {
    manapoolOrderId: options?.manapoolOrderId ?? `test-order-${Date.now()}`,
    reference: options?.reference ?? "TEST-ORDER",
    lines: options?.lines ?? [
      {
        name: "Test Card B1-P1",
        setCode: "tst",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
        quantity: 1,
      },
    ],
  };

  const result = await importExternalOrder(order, TEST_CONTEXT);
  return {
    externalOrderId: result.externalOrderId,
    manapoolOrderId: result.manapoolOrderId,
  };
}

/** Seal and activate blocks so they are pickable. */
export async function makeBlocksPickable(internalIds: string[]): Promise<void> {
  await sealOpenBlocksByInternalIds(internalIds);
  for (const id of internalIds) {
    const block = await db.block.findUnique({ where: { id } });
    if (block) {
      await transitionBlockStatus(block.blockId, "ACTIVATE");
    }
  }
}
