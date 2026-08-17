import { db } from "@/lib/db";
import { systemJobContext } from "@/lib/context/domain-context";
import { markOutboxDone, markOutboxFailed, requeueOutbox } from "@/lib/channels/outbox";
import { processOutboxRow } from "@/lib/channels/sync";

const MAX_ATTEMPTS = 5;

export async function runChannelOutboxDrain(): Promise<{ processed: number; failed: number }> {
  const ctx = systemJobContext("channel-outbox-drain");
  const rows = await db.channelOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { channel: true },
  });

  let processed = 0;
  let failed = 0;

  for (const row of rows) {
    const claimed = await db.channelOutbox.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;

    try {
      await processOutboxRow(ctx, row.id);
      await markOutboxDone(row.id);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await markOutboxFailed(row.id, message);
        failed += 1;
      } else {
        await requeueOutbox(row.id);
        await db.channelOutbox.update({
          where: { id: row.id },
          data: { lastError: message.slice(0, 2000) },
        });
        failed += 1;
      }
    }
  }

  return { processed, failed };
}
