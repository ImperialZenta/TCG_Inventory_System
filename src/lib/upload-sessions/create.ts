import type { BlockChannel, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { assertBlockEligibleForUploadSession, OPEN_SESSION_STATUSES } from "@/lib/upload-sessions/guards";
import { allocateNextUploadSessionId } from "@/lib/upload-sessions/ids";
import { UploadSessionError } from "@/lib/upload-sessions/errors";

type TransactionClient = Prisma.TransactionClient;

async function findOpenSessionForBlockInTx(tx: TransactionClient, blockId: string) {
  return tx.uploadSessionBlock.findFirst({
    where: {
      blockId,
      session: { status: { in: [...OPEN_SESSION_STATUSES] } },
    },
    include: { session: { select: { sessionId: true } } },
  });
}

export interface CreateUploadSessionResult {
  sessionId: string;
  internalId: string;
  mtgBlockIds: string[];
}

export async function createUploadSession(
  ctx: DomainContext,
  blockInternalIds: string[],
  channel: BlockChannel,
): Promise<CreateUploadSessionResult> {
  const uniqueIds = [...new Set(blockInternalIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new UploadSessionError("Select at least one block");
  }

  return db.$transaction(async (tx) => {
    const blocks = await tx.block.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        blockId: true,
        status: true,
        pickHoldAt: true,
        reservedUploadSessionId: true,
      },
    });

    if (blocks.length !== uniqueIds.length) {
      throw new UploadSessionError("One or more blocks were not found");
    }

    for (const block of blocks) {
      if (block.reservedUploadSessionId) {
        const existing = await findOpenSessionForBlockInTx(tx, block.id);
        assertBlockEligibleForUploadSession(block, {
          reservedSessionDisplayId: existing?.session.sessionId,
        });
      } else {
        const existing = await findOpenSessionForBlockInTx(tx, block.id);
        assertBlockEligibleForUploadSession(block, {
          reservedSessionDisplayId: existing?.session.sessionId,
        });
      }
    }

    const displayId = await allocateNextUploadSessionId(tx);
    const actor = inventoryEventActor(ctx);

    const session = await tx.uploadSession.create({
      data: {
        sessionId: displayId,
        channel,
        status: "DRAFT",
        createdBy: actor,
      },
    });

    for (const block of blocks) {
      await tx.uploadSessionBlock.create({
        data: {
          sessionId: session.id,
          blockId: block.id,
        },
      });

      await tx.block.update({
        where: { id: block.id },
        data: { reservedUploadSessionId: session.id },
      });
    }

    const mtgBlockIds = blocks.map((b) => b.blockId).sort();

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.UPLOAD_SESSION_CREATED,
      payload: {
        sessionId: displayId,
        channel,
        mtgBlockIds,
      },
      uploadSessionId: session.id,
      correlationId: session.id,
    });

    return {
      sessionId: displayId,
      internalId: session.id,
      mtgBlockIds,
    };
  });
}
