import PgBoss from "pg-boss";
import { runReservationExpirySweep } from "@/lib/jobs/reservation-expiry";
import { runChannelOutboxDrain } from "@/lib/jobs/channel-outbox-drain";

export const RESERVATION_EXPIRY_QUEUE = "reservation-expiry";
export const CHANNEL_OUTBOX_DRAIN_QUEUE = "channel-outbox-drain";

const RESERVATION_EXPIRY_CRON = "*/5 * * * *";
const CHANNEL_OUTBOX_DRAIN_CRON = "*/1 * * * *";

export async function createJobBoss(connectionString: string): Promise<PgBoss> {
  const boss = new PgBoss(connectionString);
  await boss.start();
  return boss;
}

export async function registerJobs(boss: PgBoss): Promise<void> {
  await boss.work(RESERVATION_EXPIRY_QUEUE, async () => {
    const released = await runReservationExpirySweep();
    console.log(`[${RESERVATION_EXPIRY_QUEUE}] released ${released} reservation(s)`);
  });

  await boss.work(CHANNEL_OUTBOX_DRAIN_QUEUE, async () => {
    const result = await runChannelOutboxDrain();
    console.log(
      `[${CHANNEL_OUTBOX_DRAIN_QUEUE}] processed ${result.processed}, failed ${result.failed}`,
    );
  });

  await boss.schedule(RESERVATION_EXPIRY_QUEUE, RESERVATION_EXPIRY_CRON);
  await boss.schedule(CHANNEL_OUTBOX_DRAIN_QUEUE, CHANNEL_OUTBOX_DRAIN_CRON);
}
