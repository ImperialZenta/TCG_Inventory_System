import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getShelvesWithBins, getBinUtilization } from "@/lib/location";
import { db } from "@/lib/db";
import { getDefaultFormalizeBinId } from "@/lib/staging/defaults";
import { SuggestedIds } from "./suggested-ids";
import { TargetCountForm } from "./target-count-form";
import { DefaultBinForm } from "./default-bin-form";
import { AddShelfForm } from "./add-shelf-form";
import { AddBinForm } from "./add-bin-form";
import { DangerZone } from "./danger-zone";
import { RestoreBackupForm } from "@/components/restore-backup-form";
import { restoreBackupAction } from "./restore-actions";
import { BackfillPricesForm } from "./backfill-prices-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let shelves: Awaited<ReturnType<typeof getShelvesWithBins>> = [];
  let bins: Awaited<ReturnType<typeof getBinUtilization>> = [];
  let targetCount = "50";
  let defaultFormalizeBinId: string | null = null;
  let dbError = false;

  try {
    [shelves, bins] = await Promise.all([getShelvesWithBins(), getBinUtilization()]);
    const setting = await db.appSetting.findUnique({
      where: { key: "default_staging_target_count" },
    });
    targetCount = setting?.value ?? "50";
    defaultFormalizeBinId = await getDefaultFormalizeBinId();
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure shelves, bins, staging defaults, backups, and Mana Pool credentials."
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations and seed — see README Docker section.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Shelves & Bins</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Shelf code → Bin ID → Block. Bins accept unlimited blocks; utilization shows how many
            are assigned.
          </p>

          <SuggestedIds shelves={shelves} />

          <AddShelfForm />
          <AddBinForm shelves={shelves} />
        </section>

        <div className="space-y-8">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Bin utilization</h2>
            <div className="mt-4 space-y-2">
              {bins.length === 0 ? (
                <p className="text-sm text-zinc-500">No bins configured yet.</p>
              ) : (
                bins.map((bin) => (
                  <div
                    key={bin.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-mono text-zinc-100">{bin.binId}</span>
                      <span className="ml-2 text-zinc-500">{bin.shelf?.code ?? "Unassigned"}</span>
                    </div>
                    <span className="text-zinc-400">
                      {bin.used} block{bin.used === 1 ? "" : "s"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Staging defaults</h2>
            <TargetCountForm targetCount={targetCount} />
            <DefaultBinForm
              bins={bins.map((bin) => ({
                id: bin.id,
                binId: bin.binId,
                shelfCode: bin.shelf?.code ?? "Unassigned",
                used: bin.used,
              }))}
              defaultFormalizeBinId={defaultFormalizeBinId}
            />
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Backup & credentials</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Export all inventory data as JSON. Mana Pool API credentials go in your{" "}
              <code className="text-amber-400">.env</code> file.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-400">
              <p>
                <code className="text-zinc-300">MANAPOOL_EMAIL</code> — seller account email
              </p>
              <p>
                <code className="text-zinc-300">MANAPOOL_API_TOKEN</code> — from Mana Pool account
              </p>
              <p>
                <code className="text-zinc-300">MANAPOOL_WEBHOOK_SECRET</code> — verify inbound order
                webhooks (required in production; 503 if unset)
              </p>
              <p>
                <code className="text-zinc-300">CRON_SECRET</code> — protect{" "}
                <code className="text-zinc-300">POST /api/cron/sync-manapool-orders</code> (required in
                production)
              </p>
              <p>
                <code className="text-zinc-300">ALLOW_INSECURE_INBOUND</code> — local dev only; allows
                webhook/cron without secrets
              </p>
              <p className="pt-2 text-zinc-500">
                Webhook URL:{" "}
                <code className="text-zinc-300">/api/webhooks/manapool</code>
              </p>
            </div>
            <Link
              href="/api/backup/export"
              className="mt-4 inline-flex rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
            >
              Download backup JSON
            </Link>
            <Link
              href="/activity"
              className="mt-3 inline-flex text-sm text-zinc-400 hover:text-zinc-200"
            >
              View activity log →
            </Link>

            <RestoreBackupForm action={restoreBackupAction} />

            <BackfillPricesForm />
          </section>
        </div>
      </div>

      <div className="mt-8">
        <DangerZone />
      </div>
    </>
  );
}
