import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import {
  aggregateCardLinesForListing,
  toManaPoolCsv,
} from "@/lib/manapool/csv-export";
import {
  assertBlockValidInOpenSession,
  OPEN_SESSION_STATUSES,
} from "@/lib/upload-sessions/guards";
import { UploadSessionError } from "@/lib/upload-sessions/errors";

export interface GenerateUploadSessionCsvResult {
  sessionId: string;
  csv: string;
  filename: string;
  rowCount: number;
  mtgBlockIds: string[];
}

async function loadOpenSession(sessionRef: string) {
  const session = await db.uploadSession.findFirst({
    where: {
      OR: [{ sessionId: sessionRef }, { id: sessionRef }],
      status: { in: [...OPEN_SESSION_STATUSES] },
    },
    include: {
      blocks: {
        include: {
          block: {
            include: { cards: true },
          },
        },
        orderBy: { block: { blockId: "asc" } },
      },
    },
  });

  if (!session) {
    throw new UploadSessionError("Upload session not found or no longer open");
  }

  return session;
}

function validateSessionBlocks(
  session: Awaited<ReturnType<typeof loadOpenSession>>,
): string[] {
  const mtgBlockIds: string[] = [];

  for (const membership of session.blocks) {
    const block = membership.block;
    assertBlockValidInOpenSession(block, session.id, session.sessionId);
    mtgBlockIds.push(block.blockId);
  }

  return mtgBlockIds.sort();
}

export async function generateUploadSessionCsv(
  ctx: DomainContext,
  sessionRef: string,
): Promise<GenerateUploadSessionCsvResult> {
  const session = await loadOpenSession(sessionRef);
  const mtgBlockIds = validateSessionBlocks(session);

  const allLines = session.blocks.flatMap((m) => m.block.cards);
  const rows = aggregateCardLinesForListing(allLines);

  if (rows.length === 0) {
    throw new UploadSessionError(
      "No listable singles in this session (bulk lines without Scryfall ID are excluded)",
    );
  }

  const csv = toManaPoolCsv(rows);
  const filename = `${session.sessionId}-manapool-listing.csv`;

  await db.$transaction(async (tx) => {
    const current = await tx.uploadSession.findUnique({
      where: { id: session.id },
      select: { status: true },
    });

    if (!current || !OPEN_SESSION_STATUSES.includes(current.status as (typeof OPEN_SESSION_STATUSES)[number])) {
      throw new UploadSessionError("Upload session is no longer open");
    }

    await tx.uploadSession.update({
      where: { id: session.id },
      data: {
        status: "CSV_READY",
        csvGeneratedAt: new Date(),
      },
    });

    await tx.uploadExportAudit.create({
      data: {
        sessionId: session.id,
        rowCount: rows.length,
        blockIds: mtgBlockIds,
        filename,
        actor: ctx.actor?.email ?? ctx.actor?.id ?? null,
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.UPLOAD_CSV_GENERATED,
      payload: {
        sessionId: session.sessionId,
        rowCount: rows.length,
        mtgBlockIds,
      },
      uploadSessionId: session.id,
      correlationId: session.id,
    });
  });

  return {
    sessionId: session.sessionId,
    csv,
    filename,
    rowCount: rows.length,
    mtgBlockIds,
  };
}

export async function getUploadSessionCsvForDownload(
  sessionRef: string,
): Promise<{ csv: string; filename: string }> {
  const session = await db.uploadSession.findFirst({
    where: {
      OR: [{ sessionId: sessionRef }, { id: sessionRef }],
      status: { in: ["DRAFT", "CSV_READY"] },
    },
    include: {
      blocks: {
        include: { block: { include: { cards: true } } },
      },
    },
  });

  if (!session) {
    throw new UploadSessionError("Upload session not found or CSV not available");
  }

  validateSessionBlocks(session);

  const allLines = session.blocks.flatMap((m) => m.block.cards);
  const rows = aggregateCardLinesForListing(allLines);

  if (rows.length === 0) {
    throw new UploadSessionError("No listable singles in this session");
  }

  return {
    csv: toManaPoolCsv(rows),
    filename: `${session.sessionId}-manapool-listing.csv`,
  };
}
