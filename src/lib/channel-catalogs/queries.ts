import type { BlockChannel } from "@prisma/client";
import { db } from "@/lib/db";

export interface ChannelCatalogListRow {
  id: string;
  channel: BlockChannel;
  label: string;
  memberCount: number;
  createdAt: Date;
}

export interface ChannelCatalogBinRow {
  id: string;
  binId: string;
  binDisplayId: string;
  shelfCode: string | null;
  label: string | null;
}

export interface ChannelCatalogDetail {
  id: string;
  channel: BlockChannel;
  label: string;
  createdAt: Date;
  bins: ChannelCatalogBinRow[];
}

export interface ChannelCatalogSummary {
  id: string;
  channel: BlockChannel;
  label: string;
  memberCount: number;
  sealedBlockCount: number;
  members: Array<{
    membershipId: string;
    binInternalId: string;
    binDisplayId: string;
    shelfCode: string | null;
    sealedBlockCount: number;
  }>;
}

export async function listCatalogSummaries(): Promise<ChannelCatalogSummary[]> {
  const catalogs = await db.channelCatalog.findMany({
    include: {
      bins: {
        include: {
          bin: {
            include: {
              shelf: true,
              blocks: {
                where: { status: "SEALED" },
                select: { id: true },
              },
            },
          },
        },
        orderBy: { bin: { binId: "asc" } },
      },
    },
    orderBy: [{ channel: "asc" }, { label: "asc" }],
  });

  return catalogs.map((catalog) => {
    const members = catalog.bins.map((membership) => ({
      membershipId: membership.id,
      binInternalId: membership.binId,
      binDisplayId: membership.bin.binId,
      shelfCode: membership.bin.shelf?.code ?? null,
      sealedBlockCount: membership.bin.blocks.length,
    }));

    return {
      id: catalog.id,
      channel: catalog.channel,
      label: catalog.label,
      memberCount: members.length,
      sealedBlockCount: members.reduce((sum, m) => sum + m.sealedBlockCount, 0),
      members,
    };
  });
}

export async function listChannelCatalogs(
  channel?: BlockChannel,
): Promise<ChannelCatalogListRow[]> {
  const catalogs = await db.channelCatalog.findMany({
    where: channel ? { channel } : undefined,
    include: { _count: { select: { bins: true } } },
    orderBy: [{ channel: "asc" }, { label: "asc" }],
  });

  return catalogs.map((c) => ({
    id: c.id,
    channel: c.channel,
    label: c.label,
    memberCount: c._count.bins,
    createdAt: c.createdAt,
  }));
}

export async function getCatalogWithBins(catalogId: string): Promise<ChannelCatalogDetail | null> {
  const catalog = await db.channelCatalog.findUnique({
    where: { id: catalogId },
    include: {
      bins: {
        include: {
          bin: { include: { shelf: true } },
        },
        orderBy: { bin: { binId: "asc" } },
      },
    },
  });

  if (!catalog) return null;

  return {
    id: catalog.id,
    channel: catalog.channel,
    label: catalog.label,
    createdAt: catalog.createdAt,
    bins: catalog.bins.map((m) => ({
      id: m.id,
      binId: m.binId,
      binDisplayId: m.bin.binId,
      shelfCode: m.bin.shelf?.code ?? null,
      label: m.bin.label,
    })),
  };
}

export async function findCatalogForBin(
  binInternalId: string,
  channel: BlockChannel,
): Promise<{ catalogId: string; catalogLabel: string } | null> {
  const membership = await db.channelCatalogBin.findFirst({
    where: {
      binId: binInternalId,
      catalog: { channel },
    },
    include: { catalog: { select: { id: true, label: true } } },
  });

  if (!membership) return null;

  return {
    catalogId: membership.catalog.id,
    catalogLabel: membership.catalog.label,
  };
}

export interface CatalogDriftWarning {
  blockId: string;
  mtgBlockId: string;
  locationLabel: string;
  message: string;
}

export async function getCatalogDriftWarnings(
  sessionRef: string,
): Promise<CatalogDriftWarning[]> {
  const session = await db.uploadSession.findFirst({
    where: {
      OR: [{ sessionId: sessionRef }, { id: sessionRef }],
    },
    include: {
      blocks: {
        include: {
          block: {
            include: {
              bin: { include: { shelf: true } },
            },
          },
        },
      },
    },
  });

  if (!session) return [];

  const warnings: CatalogDriftWarning[] = [];

  for (const membership of session.blocks) {
    const block = membership.block;
    if (!block.binId || !block.bin) continue;

    const catalogMembership = await findCatalogForBin(block.binId, session.channel);
    if (catalogMembership) continue;

    const shelf = block.bin.shelf?.code;
    const binId = block.bin.binId;
    const locationLabel = shelf && binId ? `${shelf} / ${binId}` : binId ?? "Unassigned";

    warnings.push({
      blockId: block.id,
      mtgBlockId: block.blockId,
      locationLabel,
      message: `${block.blockId} is at ${locationLabel}, which is not in a catalog for this session's channel`,
    });
  }

  return warnings;
}
