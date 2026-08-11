import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { BLOCK_CHANNEL_LABELS } from "@/lib/constants";
import { ChannelCatalogError } from "@/lib/channel-catalogs/errors";

type TransactionClient = Prisma.TransactionClient;

async function findConflictingMembership(
  tx: TransactionClient,
  binInternalId: string,
  channel: string,
  excludeCatalogId?: string,
) {
  return tx.channelCatalogBin.findFirst({
    where: {
      binId: binInternalId,
      catalog: {
        channel: channel as Prisma.EnumBlockChannelFilter["equals"],
        ...(excludeCatalogId ? { id: { not: excludeCatalogId } } : {}),
      },
    },
    include: {
      catalog: { select: { id: true, label: true, channel: true } },
      bin: { select: { binId: true } },
    },
  });
}

export interface AssignBinResult {
  catalogId: string;
  binId: string;
  binDisplayId: string;
}

export async function assignBinToCatalog(
  _ctx: DomainContext,
  catalogId: string,
  binRef: string,
): Promise<AssignBinResult> {
  return db.$transaction(async (tx) => {
    const catalog = await tx.channelCatalog.findUnique({
      where: { id: catalogId },
    });
    if (!catalog) {
      throw new ChannelCatalogError("Channel catalog not found");
    }

    const bin = await tx.bin.findFirst({
      where: { OR: [{ id: binRef }, { binId: binRef }] },
    });
    if (!bin) {
      throw new ChannelCatalogError("Bin not found");
    }

    const existingInCatalog = await tx.channelCatalogBin.findUnique({
      where: { catalogId_binId: { catalogId, binId: bin.id } },
    });
    if (existingInCatalog) {
      return { catalogId, binId: bin.id, binDisplayId: bin.binId };
    }

    const conflict = await findConflictingMembership(tx, bin.id, catalog.channel, catalogId);
    if (conflict) {
      const channelLabel = BLOCK_CHANNEL_LABELS[catalog.channel] ?? catalog.channel;
      throw new ChannelCatalogError(
        `Bin ${bin.binId} is already in ${channelLabel} catalog "${conflict.catalog.label}"`,
      );
    }

    await tx.channelCatalogBin.create({
      data: { catalogId, binId: bin.id },
    });

    return { catalogId, binId: bin.id, binDisplayId: bin.binId };
  });
}

export interface RemoveBinResult {
  catalogId: string;
  binId: string;
  binDisplayId: string;
}

export async function removeBinFromCatalog(
  _ctx: DomainContext,
  catalogId: string,
  binRef: string,
): Promise<RemoveBinResult> {
  return db.$transaction(async (tx) => {
    const catalog = await tx.channelCatalog.findUnique({
      where: { id: catalogId },
    });
    if (!catalog) {
      throw new ChannelCatalogError("Channel catalog not found");
    }

    const bin = await tx.bin.findFirst({
      where: { OR: [{ id: binRef }, { binId: binRef }] },
    });
    if (!bin) {
      throw new ChannelCatalogError("Bin not found");
    }

    const membership = await tx.channelCatalogBin.findUnique({
      where: { catalogId_binId: { catalogId, binId: bin.id } },
    });
    if (!membership) {
      throw new ChannelCatalogError(`Bin ${bin.binId} is not in this catalog`);
    }

    await tx.channelCatalogBin.delete({
      where: { id: membership.id },
    });

    return { catalogId, binId: bin.id, binDisplayId: bin.binId };
  });
}
