import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";
import { getBlocksWithStats, getAgingBucketCounts, getStaleBlocks, getLocationLabel } from "@/lib/blocks";
import { getPickMetrics } from "@/lib/pick/metrics";
import { STALE_BLOCK_DAYS } from "@/lib/constants";
import { formatCurrency, daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let blocks: Awaited<ReturnType<typeof getBlocksWithStats>> = [];
  let aging = { buckets: [] as { label: string; count: number }[], staleThreshold: STALE_BLOCK_DAYS };
  let staleBlocks: Awaited<ReturnType<typeof getStaleBlocks>> = [];
  let pickMetrics: Awaited<ReturnType<typeof getPickMetrics>> | null = null;
  let dbError = false;

  try {
    [blocks, aging, staleBlocks, pickMetrics] = await Promise.all([
      getBlocksWithStats(),
      getAgingBucketCounts(STALE_BLOCK_DAYS),
      getStaleBlocks(STALE_BLOCK_DAYS),
      getPickMetrics(),
    ]);
  } catch {
    dbError = true;
  }

  const totalValue = blocks.reduce((sum, b) => sum + b.estimatedValue, 0);
  const staleValue = staleBlocks.reduce((sum, b) => sum + b.estimatedValue, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Block aging, velocity, and capital tied up in slow-moving chaos inventory."
      />

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run db:push and db:seed to populate sample data for analytics."
        />
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-sm text-zinc-400">Capital in Stale Blocks</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{formatCurrency(staleValue)}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {((staleValue / (totalValue || 1)) * 100).toFixed(0)}% of total inventory value
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-sm text-zinc-400">Stale Block Count</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{staleBlocks.length}</p>
              <p className="mt-1 text-xs text-zinc-500">Threshold: {STALE_BLOCK_DAYS} days without pick</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <p className="text-sm text-zinc-400">Total Block Value</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatCurrency(totalValue)}</p>
            </div>
          </div>

          {pickMetrics && (
            <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <h2 className="text-lg font-medium text-zinc-100">Pick performance</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs text-zinc-500">Completed lists</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">
                    {pickMetrics.completedLists}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs text-zinc-500">Median pick time</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">
                    {pickMetrics.medianDurationMinutes != null
                      ? `${Math.round(pickMetrics.medianDurationMinutes)}m`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs text-zinc-500">Short rate</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-400">
                    {pickMetrics.shortRatePercent != null
                      ? `${pickMetrics.shortRatePercent.toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs text-zinc-500">Median dwell (days)</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-100">
                    {pickMetrics.medianDwellDays != null
                      ? Math.round(pickMetrics.medianDwellDays)
                      : "—"}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Aging Buckets</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {aging.buckets.map((bucket) => (
                <div key={bucket.label} className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-center">
                  <p className="text-2xl font-semibold text-zinc-100">{bucket.count}</p>
                  <p className="mt-1 text-xs text-zinc-400">{bucket.label}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-100">
              Stale Blocks — Recommended Review
            </h2>
            {staleBlocks.length === 0 ? (
              <p className="text-sm text-zinc-500">All blocks are within the aging threshold.</p>
            ) : (
              <div className="space-y-2">
                {staleBlocks.map((block) => {
                  const days = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
                  return (
                    <Link
                      key={block.id}
                      href={`/blocks/${block.blockId}`}
                      className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 transition hover:border-amber-500/40"
                    >
                      <div>
                        <p className="font-mono text-zinc-100">{block.blockId}</p>
                        <p className="text-sm text-zinc-400">
                          {getLocationLabel(block)} · {block.cardCount} cards ·{" "}
                          {formatCurrency(block.estimatedValue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-400">{days}d idle</p>
                        <p className="text-xs text-zinc-500">Sort · bundle · liquidate</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
