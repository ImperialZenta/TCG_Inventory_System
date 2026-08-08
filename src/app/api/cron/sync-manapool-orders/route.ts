import { NextResponse } from "next/server";
import { importOrdersFromManaPool } from "@/lib/orders/import-orders-batch";
import type { DomainContext } from "@/lib/context/domain-context";

const CRON_CONTEXT: DomainContext = {
  actor: { id: "cron:sync-orders" },
  source: "api",
};

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await importOrdersFromManaPool(CRON_CONTEXT);
    await import("@/lib/db").then(({ db }) =>
      db.appSetting.upsert({
        where: { key: "manapool_last_sync_at" },
        create: { key: "manapool_last_sync_at", value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      }),
    );

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
