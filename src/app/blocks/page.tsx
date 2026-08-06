import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { getBlocksWithStats, getLocationLabel, formatSealedAt, isSealedAtPending } from "@/lib/blocks";
import { getBinSealSummary } from "@/lib/blocks/seal";
import { getBinUtilization } from "@/lib/location";
import { getDefaultFormalizeBinId } from "@/lib/staging/defaults";
import { BulkSealByBinForm } from "./bulk-seal-by-bin-form";
import {
  BLOCK_CHANNEL_LABELS,
  BLOCK_STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface BlocksPageProps {
  searchParams: Promise<{ removedBlock?: string; cardsRemoved?: string }>;
}

async function loadBinSealOptions() {
  const bins = await getBinUtilization();
  return Promise.all(
    bins.map(async (bin) => ({
      id: bin.id,
      binId: bin.binId,
      shelfCode: bin.shelf?.code ?? "Unassigned",
      used: bin.used,
      sealSummary: await getBinSealSummary(bin.id),
    })),
  );
}

export default async function BlocksPage({ searchParams }: BlocksPageProps) {
  const query = await searchParams;
  const removedBlock = query.removedBlock?.trim();
  const cardsRemoved = query.cardsRemoved ? Number.parseInt(query.cardsRemoved, 10) : 0;

  let blocks: Awaited<ReturnType<typeof getBlocksWithStats>> = [];
  let binSealOptions: Awaited<ReturnType<typeof loadBinSealOptions>> = [];
  let defaultFormalizeBinId: string | null = null;
  let dbError = false;

  try {
    [blocks, binSealOptions, defaultFormalizeBinId] = await Promise.all([
      getBlocksWithStats(),
      loadBinSealOptions(),
      getDefaultFormalizeBinId(),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Blocks"
        description="Chaos blocks on shelves and bins — sorted by pack date (newest first)."
        action={
          <Link
            href="/staging"
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            Staging
          </Link>
        }
      />

      {removedBlock && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium text-emerald-200">
            Removed {removedBlock}
            {Number.isFinite(cardsRemoved) && cardsRemoved > 0 && (
              <>
                {" "}
                ({cardsRemoved} card{cardsRemoved === 1 ? "" : "s"})
              </>
            )}
          </p>
        </div>
      )}

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run docker compose up --build, then seed: docker compose exec app npm run db:seed"
        />
      ) : blocks.length === 0 ? (
        <EmptyState
          title="No blocks yet"
          description="Configure shelves in Settings, then import staging cards to create blocks."
          action={
            <Link
              href="/settings"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950"
            >
              Open Settings
            </Link>
          }
        />
      ) : (
        <>
          <BulkSealByBinForm bins={binSealOptions} defaultBinId={defaultFormalizeBinId} />
          <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Block ID</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Sealed</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium text-right">Cards</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium">Last Pick</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {blocks.map((block) => {
                const idleDays = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
                const isStale = idleDays !== null && idleDays >= 90;

                return (
                  <tr key={block.id} className="bg-zinc-950/30 transition hover:bg-zinc-900/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blocks/${block.blockId}`}
                        className="font-mono text-amber-400 hover:text-amber-300"
                      >
                        {block.blockId}
                      </Link>
                      {block.label && <p className="text-xs text-zinc-500">{block.label}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {getLocationLabel(block)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          block.status === "OPEN"
                            ? "warning"
                            : block.status === "SEALED"
                              ? "muted"
                              : "default"
                        }
                      >
                        {BLOCK_STATUS_LABELS[block.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          isSealedAtPending(block)
                            ? "text-amber-400/90"
                            : "text-zinc-400"
                        }
                      >
                        {formatSealedAt(block)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {BLOCK_CHANNEL_LABELS[block.channel]}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">
                      {block.cardCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">
                      {formatCurrency(block.estimatedValue)}
                    </td>
                    <td className="px-4 py-3">
                      {block.lastPickAt ? (
                        <span className={isStale ? "text-amber-400" : "text-zinc-400"}>
                          {formatDate(block.lastPickAt)}
                          {idleDays !== null && (
                            <span className="ml-1 text-xs">({idleDays}d)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-amber-400">Never</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}
