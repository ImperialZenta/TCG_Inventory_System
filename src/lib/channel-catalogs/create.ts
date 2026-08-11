import type { BlockChannel } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { ChannelCatalogError } from "@/lib/channel-catalogs/errors";

export interface CreateChannelCatalogResult {
  id: string;
  channel: BlockChannel;
  label: string;
}

export async function createChannelCatalog(
  _ctx: DomainContext,
  channel: BlockChannel,
  label: string,
): Promise<CreateChannelCatalogResult> {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new ChannelCatalogError("Catalog label is required");
  }

  const catalog = await db.channelCatalog.create({
    data: { channel, label: trimmed },
  });

  return {
    id: catalog.id,
    channel: catalog.channel,
    label: catalog.label,
  };
}
