import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { requirePermission, PERMISSIONS } from "@/lib/auth/permissions";
import {
  assertBlockHasNoPickItems,
  BLOCK_HAS_PICK_HISTORY_MESSAGE,
  isForeignKeyViolation,
  PickGuardError,
} from "@/lib/blocks/pick-guard";
import { getBlockRemovalEligibility } from "@/lib/blocks/removal-eligibility";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";

export class RemoveBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoveBlockError";
  }
}

export interface RemoveBlockResult {
  blockId: string;
  cardCount: number;
  /** @deprecated Use importUnlocked — count of imports reset to PARSED */
  stagingImportsReset: number;
  stagingImportId: string | null;
  stagingImportIds: string[];
  importUnlocked: boolean;
  remainingBlocksOnImport: number;
}

/**
 * Permanently removes a block and its card lines.
 * Clears staging links so formalized imports can be re-formalized or deleted
 * once all of their blocks are gone. Refuses when pick items still reference the block.
 */
export async function removeBlockByBlockId(
  ctx: DomainContext,
  blockId: string,
): Promise<RemoveBlockResult> {
  await requirePermission(ctx, PERMISSIONS.BLOCK_REMOVE);
  const block = await db.block.findUnique({
    where: { blockId },
    include: {
      cards: { select: { quantity: true } },
      _count: { select: { pickItems: true } },
    },
  });

  if (!block) {
    throw new RemoveBlockError("Block not found");
  }

  const eligibility = getBlockRemovalEligibility({
    status: block.status,
    pickItemCount: block._count.pickItems,
    reservedUploadSessionId: block.reservedUploadSessionId,
  });
  if (!eligibility.allowed) {
    throw new RemoveBlockError(eligibility.reason ?? "Cannot remove this block");
  }

  const cardCount = block.cards.reduce((sum, card) => sum + card.quantity, 0);
  const blockInternalId = block.id;
  const humanBlockId = block.blockId;
  const blockStatus = block.status;

  const outcome = await db.$transaction(async (tx) => {
      const current = await tx.block.findUnique({
        where: { id: blockInternalId },
        select: {
          status: true,
          reservedUploadSessionId: true,
          _count: { select: { pickItems: true } },
        },
      });

      if (!current) {
        throw new RemoveBlockError("Block not found");
      }

      const txEligibility = getBlockRemovalEligibility({
        status: current.status,
        pickItemCount: current._count.pickItems,
        reservedUploadSessionId: current.reservedUploadSessionId,
      });
      if (!txEligibility.allowed) {
        throw new RemoveBlockError(txEligibility.reason ?? "Cannot remove this block");
      }

      try {
        await assertBlockHasNoPickItems(tx, blockInternalId);
      } catch (error) {
        if (error instanceof PickGuardError) {
          throw new RemoveBlockError(error.message);
        }
        throw new RemoveBlockError("Block not found");
      }

      const linkedCards = await tx.stagingCard.findMany({
        where: { assignedBlockId: blockInternalId },
        select: { stagingImportId: true },
        distinct: ["stagingImportId"],
      });
      const importIds = linkedCards.map((row) => row.stagingImportId);

      await tx.stagingCard.updateMany({
        where: { assignedBlockId: blockInternalId },
        data: { assignedBlockId: null },
      });

      await recordInventoryEvent(tx, ctx, {
        eventType: INVENTORY_EVENT_TYPES.BLOCK_REMOVED,
        payload: {
          mtgBlockId: humanBlockId,
          cardCount,
          priorStatus: blockStatus,
        },
        blockId: blockInternalId,
        stagingImportId: importIds[0] ?? null,
      });

      try {
        await tx.block.delete({ where: { id: blockInternalId } });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new RemoveBlockError(BLOCK_HAS_PICK_HISTORY_MESSAGE);
        }
        throw error;
      }

      let resetCount = 0;
      let importUnlocked = false;
      let remainingBlocksOnImport = 0;
      const primaryImportId = importIds[0] ?? null;

      for (const importId of importIds) {
        const stillAssigned = await tx.stagingCard.count({
          where: { stagingImportId: importId, assignedBlockId: { not: null } },
        });
        if (stillAssigned === 0) {
          await tx.stagingImport.updateMany({
            where: { id: importId, status: "ASSIGNED" },
            data: { status: "PARSED" },
          });
          resetCount++;
          if (importId === primaryImportId) {
            importUnlocked = true;
          }
        } else if (importId === primaryImportId) {
          const distinctBlocks = await tx.stagingCard.findMany({
            where: { stagingImportId: importId, assignedBlockId: { not: null } },
            select: { assignedBlockId: true },
            distinct: ["assignedBlockId"],
          });
          remainingBlocksOnImport = distinctBlocks.length;
        }
      }

      return {
        stagingImportsReset: resetCount,
        stagingImportId: primaryImportId,
        stagingImportIds: importIds,
        importUnlocked,
      remainingBlocksOnImport,
    };
  });

  return {
    blockId: humanBlockId,
    cardCount,
    stagingImportsReset: outcome.stagingImportsReset,
    stagingImportId: outcome.stagingImportId,
    stagingImportIds: outcome.stagingImportIds,
    importUnlocked: outcome.importUnlocked,
    remainingBlocksOnImport: outcome.remainingBlocksOnImport,
  };
}
