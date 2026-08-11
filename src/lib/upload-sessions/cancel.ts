import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { OPEN_SESSION_STATUSES } from "@/lib/upload-sessions/guards";
import { UploadSessionError } from "@/lib/upload-sessions/errors";

export interface CancelUploadSessionResult {
  sessionId: string;
  mtgBlockIds: string[];
}

export async function cancelUploadSession(
  ctx: DomainContext,
  sessionRef: string,
): Promise<CancelUploadSessionResult> {
  return db.$transaction(async (tx) => {
    const session = await tx.uploadSession.findFirst({
      where: {
        OR: [{ sessionId: sessionRef }, { id: sessionRef }],
      },
      include: {
        blocks: {
          include: { block: { select: { id: true, blockId: true } } },
        },
      },
    });

    if (!session) {
      throw new UploadSessionError("Upload session not found");
    }

    if (session.status === "CANCELLED") {
      return {
        sessionId: session.sessionId,
        mtgBlockIds: session.blocks.map((m) => m.block.blockId).sort(),
      };
    }

    if (!OPEN_SESSION_STATUSES.includes(session.status as (typeof OPEN_SESSION_STATUSES)[number])) {
      throw new UploadSessionError(
        `Cannot cancel — session is ${session.status.toLowerCase()}`,
      );
    }

    const mtgBlockIds = session.blocks.map((m) => m.block.blockId).sort();

    for (const membership of session.blocks) {
      await tx.block.update({
        where: { id: membership.blockId },
        data: { reservedUploadSessionId: null },
      });
    }

    await tx.uploadSession.update({
      where: { id: session.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.UPLOAD_CANCELLED,
      payload: {
        sessionId: session.sessionId,
        mtgBlockIds,
      },
      uploadSessionId: session.id,
      correlationId: session.id,
    });

    return { sessionId: session.sessionId, mtgBlockIds };
  });
}
