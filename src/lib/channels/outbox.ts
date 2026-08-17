import type { ChannelOutboxOperation, Prisma } from "@prisma/client";
import type { OutboxPayload } from "@/lib/channels/types";

type TransactionClient = Prisma.TransactionClient;

export function buildOutboxIdempotencyKey(
  stockItemId: string,
  channelId: string,
  onHand: number,
  reserved: number,
  operation: ChannelOutboxOperation,
): string {
  return `${stockItemId}:${channelId}:${onHand}:${reserved}:${operation}`;
}

export async function enqueueOutboxInTx(
  tx: TransactionClient,
  input: {
    channelId: string;
    operation: ChannelOutboxOperation;
    payload: OutboxPayload;
    idempotencyKey: string;
  },
): Promise<void> {
  const existing = await tx.channelOutbox.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing && (existing.status === "PENDING" || existing.status === "PROCESSING")) {
    return;
  }
  if (existing?.status === "DONE") {
    return;
  }

  await tx.channelOutbox.create({
    data: {
      channelId: input.channelId,
      operation: input.operation,
      payload: input.payload as unknown as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      status: "PENDING",
    },
  });
}

export async function claimPendingOutboxRows(limit = 20) {
  return claimPendingOutboxRowsInTx(undefined, limit);
}

export async function claimPendingOutboxRowsInTx(
  tx: Prisma.TransactionClient | undefined,
  limit = 20,
) {
  const client = tx ?? (await import("@/lib/db")).db;
  const rows = await client.channelOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { channel: true },
  });

  const claimed = [];
  for (const row of rows) {
    const updated = await client.channelOutbox.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (updated.count === 1) {
      claimed.push({ ...row, status: "PROCESSING" as const, attempts: row.attempts + 1 });
    }
  }
  return claimed;
}

export async function markOutboxDone(outboxId: string): Promise<void> {
  await (await import("@/lib/db")).db.channelOutbox.update({
    where: { id: outboxId },
    data: { status: "DONE", processedAt: new Date(), lastError: null },
  });
}

export async function markOutboxFailed(outboxId: string, error: string): Promise<void> {
  await (await import("@/lib/db")).db.channelOutbox.update({
    where: { id: outboxId },
    data: { status: "FAILED", lastError: error.slice(0, 2000) },
  });
}

export async function requeueOutbox(outboxId: string): Promise<void> {
  await (await import("@/lib/db")).db.channelOutbox.update({
    where: { id: outboxId },
    data: { status: "PENDING" },
  });
}
