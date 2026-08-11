import { db } from "@/lib/db";
import { aggregateCardLinesForListing } from "@/lib/manapool/csv-export";
import { OPEN_SESSION_STATUSES } from "@/lib/upload-sessions/guards";

export interface UploadSessionListRow {
  id: string;
  sessionId: string;
  channel: string;
  status: string;
  blockCount: number;
  createdAt: Date;
  csvGeneratedAt: Date | null;
  completedAt: Date | null;
}

export interface UploadSessionBlockRow {
  id: string;
  blockId: string;
  label: string | null;
  status: string;
  cardCount: number;
  listableRowCount: number;
  locationLabel: string;
}

export interface UploadSessionDetail {
  id: string;
  sessionId: string;
  channel: string;
  status: string;
  createdAt: Date;
  createdBy: string | null;
  csvGeneratedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  blocks: UploadSessionBlockRow[];
  latestExport: {
    filename: string;
    rowCount: number;
    createdAt: Date;
  } | null;
}

export interface EligibleUploadBlockRow {
  id: string;
  blockId: string;
  label: string | null;
  channel: string;
  cardCount: number;
  listableRowCount: number;
  locationLabel: string;
}

export async function listUploadSessions(limit = 50): Promise<UploadSessionListRow[]> {
  const sessions = await db.uploadSession.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      _count: { select: { blocks: true } },
    },
  });

  const openFirst = [...sessions].sort((a, b) => {
    const aOpen = OPEN_SESSION_STATUSES.includes(a.status as (typeof OPEN_SESSION_STATUSES)[number]);
    const bOpen = OPEN_SESSION_STATUSES.includes(b.status as (typeof OPEN_SESSION_STATUSES)[number]);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return openFirst.map((s) => ({
    id: s.id,
    sessionId: s.sessionId,
    channel: s.channel,
    status: s.status,
    blockCount: s._count.blocks,
    createdAt: s.createdAt,
    csvGeneratedAt: s.csvGeneratedAt,
    completedAt: s.completedAt,
  }));
}

export async function getUploadSessionDetail(
  sessionRef: string,
): Promise<UploadSessionDetail | null> {
  const session = await db.uploadSession.findFirst({
    where: {
      OR: [{ sessionId: sessionRef }, { id: sessionRef }],
    },
    include: {
      blocks: {
        include: {
          block: {
            include: {
              cards: true,
              bin: { include: { shelf: true } },
            },
          },
        },
        orderBy: { block: { blockId: "asc" } },
      },
      exportAudits: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!session) return null;

  const latestExport = session.exportAudits[0] ?? null;

  return {
    id: session.id,
    sessionId: session.sessionId,
    channel: session.channel,
    status: session.status,
    createdAt: session.createdAt,
    createdBy: session.createdBy,
    csvGeneratedAt: session.csvGeneratedAt,
    completedAt: session.completedAt,
    cancelledAt: session.cancelledAt,
    latestExport: latestExport
      ? {
          filename: latestExport.filename,
          rowCount: latestExport.rowCount,
          createdAt: latestExport.createdAt,
        }
      : null,
    blocks: session.blocks.map((m) => {
      const block = m.block;
      const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
      const listableRowCount = aggregateCardLinesForListing(block.cards).length;
      const shelf = block.bin?.shelf?.code;
      const binId = block.bin?.binId;
      const locationLabel =
        shelf && binId ? `${shelf} / ${binId}` : binId ?? "Unassigned";

      return {
        id: block.id,
        blockId: block.blockId,
        label: block.label,
        status: block.status,
        cardCount,
        listableRowCount,
        locationLabel,
      };
    }),
  };
}

export async function listEligibleUploadBlocks(
  catalogId?: string,
): Promise<EligibleUploadBlockRow[]> {
  let binIds: string[] | undefined;
  if (catalogId) {
    const members = await db.channelCatalogBin.findMany({
      where: { catalogId },
      select: { binId: true },
    });
    binIds = members.map((m) => m.binId);
    if (binIds.length === 0) {
      return [];
    }
  }

  const blocks = await db.block.findMany({
    where: {
      status: "SEALED",
      pickHoldAt: null,
      reservedUploadSessionId: null,
      ...(binIds ? { binId: { in: binIds } } : {}),
    },
    include: {
      cards: true,
      bin: { include: { shelf: true } },
    },
    orderBy: { blockId: "asc" },
  });

  return blocks.map((block) => {
    const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
    const listableRowCount = aggregateCardLinesForListing(block.cards).length;
    const shelf = block.bin?.shelf?.code;
    const binId = block.bin?.binId;
    const locationLabel =
      shelf && binId ? `${shelf} / ${binId}` : binId ?? "Unassigned";

    return {
      id: block.id,
      blockId: block.blockId,
      label: block.label,
      channel: block.channel,
      cardCount,
      listableRowCount,
      locationLabel,
    };
  });
}

export async function getReservedSessionDisplayId(
  reservedUploadSessionId: string,
): Promise<string | null> {
  const session = await db.uploadSession.findUnique({
    where: { id: reservedUploadSessionId },
    select: { sessionId: true },
  });
  return session?.sessionId ?? null;
}
