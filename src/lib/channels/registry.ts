import type { ChannelType } from "@prisma/client";
import { manapoolChannelAdapter } from "@/lib/channels/adapters/manapool";
import type { ChannelAdapter, ChannelCapability } from "@/lib/channels/types";

const ADAPTERS: Record<ChannelType, ChannelAdapter | undefined> = {
  MANAPOOL: manapoolChannelAdapter,
  SHOPIFY: undefined,
  EBAY: undefined,
  TCGPLAYER: undefined,
};

export function getChannelAdapter(type: ChannelType): ChannelAdapter {
  const adapter = ADAPTERS[type];
  if (!adapter) {
    throw new Error(`No channel adapter registered for type ${type}`);
  }
  return adapter;
}

export function channelHasCapability(type: ChannelType, capability: ChannelCapability): boolean {
  const adapter = ADAPTERS[type];
  return adapter?.capabilities.includes(capability) ?? false;
}
