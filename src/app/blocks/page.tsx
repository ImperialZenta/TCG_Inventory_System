import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { getBlocksWithStats } from "@/lib/blocks";
import { BLOCK_STATUS_LABELS, BLOCK_TIER_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  let blocks: Awaited<ReturnType<typeof getBlocksWithStats>> = [];
  let dbError = false;

  try {
    blocks = await getBlocksWithStats();
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Blocks"
        description="Physical chaos blocks — mixed card containers tracked by location and age."
        action={
          <Link
            href="/intake"
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            New Block
          </Link>
        }
      />

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Initialize the database with db:push and db:seed, then refresh this page."
        />
      ) : blocks.length === 0 ? (
        <EmptyState
          title="No blocks yet"
          description="Pack your first block of mixed cards to start tracking chaos inventory."
          action={
            <Link
              href="/intake"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950"
            >
              Pack New Block
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Block ID</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tier</th>
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
                      <Link href={`/blocks/${block.blockId}`} className="font-mono text-amber-400 hover:text-amber-300">
                        {block.blockId}
                      </Link>
                      {block.label && <p className="text-xs text-zinc-500">{block.label}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {block.location?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={block.status === "OPEN" ? "success" : "muted"}>
                        {BLOCK_STATUS_LABELS[block.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {BLOCK_TIER_LABELS[block.tier]}
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
      )}
    </>
  );
}
