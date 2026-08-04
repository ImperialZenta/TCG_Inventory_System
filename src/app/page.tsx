import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getDashboardStats, getAgingBucketCounts, getStaleBlocks } from "@/lib/blocks";
import { STALE_BLOCK_DAYS } from "@/lib/constants";
import { formatCurrency, daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let stats = {
    blockCount: 0,
    totalCards: 0,
    totalValue: 0,
    shelfCount: 0,
    binCount: 0,
    staleBlockCount: 0,
  };
  let aging = { buckets: [] as { label: string; count: number }[], staleThreshold: STALE_BLOCK_DAYS };
  let staleBlocks: Awaited<ReturnType<typeof getStaleBlocks>> = [];
  let dbError = false;

  try {
    [stats, aging, staleBlocks] = await Promise.all([
      getDashboardStats(),
      getAgingBucketCounts(STALE_BLOCK_DAYS),
      getStaleBlocks(STALE_BLOCK_DAYS),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Chaos inventory overview — track blocks, picks, and aging stock at a glance."
        action={
          <Link
            href="/staging"
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            Staging
          </Link>
        }
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not initialized. With Docker:{" "}
          <code className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-xs">
            docker compose exec app npm run db:seed
          </code>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Blocks" value={String(stats.blockCount)} hint="Open, sealed, or active" />
        <StatCard label="Total Cards" value={stats.totalCards.toLocaleString()} />
        <StatCard
          label="Shelves / Bins"
          value={`${stats.shelfCount} / ${stats.binCount}`}
          hint="Physical storage locations"
        />
        <StatCard
          label="Est. Value / Stale"
          value={`${formatCurrency(stats.totalValue)} / ${stats.staleBlockCount}`}
          hint={`Stale = no pick in ${STALE_BLOCK_DAYS}+ days`}
          variant={stats.staleBlockCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Block Aging</h2>
          <p className="mt-1 text-sm text-zinc-400">Days since last pick (or seal date if never picked)</p>
          <div className="mt-4 space-y-3">
            {aging.buckets.map((bucket) => (
              <div key={bucket.label} className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">{bucket.label}</span>
                <span className="font-mono text-sm text-zinc-100">{bucket.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-zinc-100">Stale Blocks</h2>
              <p className="mt-1 text-sm text-zinc-400">Blocks past the {STALE_BLOCK_DAYS}-day threshold</p>
            </div>
            <Link href="/analytics" className="text-sm text-amber-400 hover:text-amber-300">
              View all →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {staleBlocks.length === 0 ? (
              <p className="text-sm text-zinc-500">No stale blocks — inventory is moving.</p>
            ) : (
              staleBlocks.slice(0, 5).map((block) => {
                const days = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
                return (
                  <Link
                    key={block.id}
                    href={`/blocks/${block.blockId}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 transition hover:border-zinc-700"
                  >
                    <div>
                      <p className="font-mono text-sm text-zinc-100">{block.blockId}</p>
                      <p className="text-xs text-zinc-500">{block.label ?? "Untitled block"}</p>
                    </div>
                    <span className="text-xs text-amber-400">{days}d idle</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>
      </div>
    </>
  );
}
