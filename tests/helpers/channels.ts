import type { ChannelSyncMode, ChannelType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const TEST_MANAPOOL_CREDS = {
  email: "test@manapool.local",
  token: "test-token",
  baseUrl: "https://manapool.test/api/v1",
};

export async function createTestChannel(input: {
  name: string;
  type: ChannelType;
  syncMode?: ChannelSyncMode;
  reserveBufferQty?: number;
  credentials?: Record<string, string>;
}) {
  return db.channel.create({
    data: {
      name: input.name,
      type: input.type,
      syncMode: input.syncMode ?? "ONE_WAY_PUSH",
      enabled: true,
      reserveBufferQty: input.reserveBufferQty ?? 0,
      credentials:
        input.credentials ?? (input.type === "MANAPOOL"
          ? (TEST_MANAPOOL_CREDS as unknown as Prisma.InputJsonValue)
          : undefined),
    },
  });
}

export async function createTestListing(channelId: string, stockItemId: string, externalListingId?: string) {
  return db.channelListing.create({
    data: {
      channelId,
      stockItemId,
      externalListingId: externalListingId ?? `ext-${stockItemId}-${channelId}`,
      status: "ACTIVE",
      lastSyncedQty: 1,
    },
  });
}
