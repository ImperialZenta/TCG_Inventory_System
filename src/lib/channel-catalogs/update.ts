import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { ChannelCatalogError } from "@/lib/channel-catalogs/errors";

export interface UpdateChannelCatalogLabelResult {
  id: string;
  label: string;
}

export async function updateChannelCatalogLabel(
  _ctx: DomainContext,
  catalogId: string,
  label: string,
): Promise<UpdateChannelCatalogLabelResult> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new ChannelCatalogError("Catalog label is required");
  }

  const existing = await db.channelCatalog.findUnique({
    where: { id: catalogId },
    select: { id: true },
  });
  if (!existing) {
    throw new ChannelCatalogError("Channel catalog not found");
  }

  const catalog = await db.channelCatalog.update({
    where: { id: catalogId },
    data: { label: trimmed },
    select: { id: true, label: true },
  });

  return catalog;
}
