import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { assertBlockValidInOpenSession } from "@/lib/upload-sessions/guards";
import { UploadSessionError } from "@/lib/upload-sessions/errors";

export interface CompleteUploadSessionResult {
  sessionId: string;
  mtgBlockIds: string[];
}

export async function completeUploadSession(
  ctx: DomainContext,
  sessionRef: string,
): Promise<CompleteUploadSessionResult> {
  return db.$transaction(async (tx) => {
    const session = await tx.uploadSession.findFirst({
      where: {
        OR: [{ sessionId: sessionRef }, { id: sessionRef }],
      },
      include: {
        blocks: {
          include: {
            block: {
              select: {
                id: true,
                blockId: true,
                status: true,
                pickHoldAt: true,
                reservedUploadSessionId: true,
                activatedAt: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new UploadSessionError("Upload session not found");
    }

    if (session.status === "COMPLETED") {
      return {
        sessionId: session.sessionId,
        mtgBlockIds: session.blocks.map((m) => m.block.blockId).sort(),
      };
    }

    if (session.status !== "CSV_READY") {
      throw new UploadSessionError(
        "Complete requires CSV_READY — generate the CSV first",
      );
    }

    const mtgBlockIds: string[] = [];

    for (const membership of session.blocks) {
      const block = membership.block;
      assertBlockValidInOpenSession(block, session.id, session.sessionId);
      mtgBlockIds.push(block.blockId);
    }

    mtgBlockIds.sort();

    for (const membership of session.blocks) {
      const block = membership.block;
      await tx.block.update({
        where: { id: block.id },
        data: {
          status: "ACTIVE",
          channel: session.channel,
          activatedAt: block.activatedAt ?? new Date(),
          reservedUploadSessionId: null,
        },
      });

      await recordInventoryEvent(tx, ctx, {
        eventType: INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE,
        payload: {
          mtgBlockId: block.blockId,
          fromStatus: "SEALED",
          toStatus: "ACTIVE",
          transition: "ACTIVATE",
        },
        blockId: block.id,
        uploadSessionId: session.id,
        correlationId: session.id,
      });
    }

    await tx.uploadSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.UPLOAD_COMPLETED,
      payload: {
        sessionId: session.sessionId,
        channel: session.channel,
        mtgBlockIds,
      },
      uploadSessionId: session.id,
      correlationId: session.id,
    });

    return { sessionId: session.sessionId, mtgBlockIds };
  });
}
