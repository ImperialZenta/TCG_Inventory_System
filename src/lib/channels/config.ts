import type { Channel, ChannelType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import type { ChannelCredentials } from "@/lib/channels/types";
import { getManaPoolConfigFromEnv } from "@/lib/manapool/client";

export interface ChannelConfig {
  channel: Channel;
  credentials: ChannelCredentials;
}

function credentialsFromEnv(type: ChannelType): ChannelCredentials | null {
  if (type === "MANAPOOL") {
    const env = getManaPoolConfigFromEnv();
    if (!env) return null;
    return {
      email: env.email,
      token: env.token,
      baseUrl: env.baseUrl,
    };
  }
  return null;
}

export async function ensureDefaultManaPoolChannel(): Promise<Channel> {
  const existing = await db.channel.findFirst({
    where: { type: "MANAPOOL" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const envCreds = credentialsFromEnv("MANAPOOL");
  return db.channel.create({
    data: {
      name: "Mana Pool",
      type: "MANAPOOL",
      syncMode: "ONE_WAY_PUSH",
      enabled: envCreds !== null,
      credentials: envCreds ? (envCreds as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function getChannelById(channelId: string): Promise<Channel | null> {
  return db.channel.findUnique({ where: { id: channelId } });
}

export async function listChannels(): Promise<Channel[]> {
  return db.channel.findMany({ orderBy: { name: "asc" } });
}

export async function getChannelConfig(
  _ctx: DomainContext,
  channelId: string,
): Promise<ChannelConfig | null> {
  const channel = await getChannelById(channelId);
  if (!channel) return null;

  let credentials = (channel.credentials as ChannelCredentials | null) ?? null;
  if (!credentials?.email || !credentials?.token) {
    const fromEnv = credentialsFromEnv(channel.type);
    if (fromEnv) {
      credentials = fromEnv;
    }
  }

  return { channel, credentials: credentials ?? {} };
}

export async function updateChannelSettings(
  channelId: string,
  data: {
    name?: string;
    reserveBufferQty?: number;
    paused?: boolean;
    enabled?: boolean;
    syncMode?: Channel["syncMode"];
  },
): Promise<Channel> {
  return db.channel.update({
    where: { id: channelId },
    data,
  });
}

export async function getManaPoolChannelId(): Promise<string> {
  const channel = await ensureDefaultManaPoolChannel();
  return channel.id;
}
