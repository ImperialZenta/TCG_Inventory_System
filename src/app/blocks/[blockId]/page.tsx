import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader, Badge } from "@/components/page-header";
import { db } from "@/lib/db";
import {
  BLOCK_CHANNEL_LABELS,
  BLOCK_STATUS_LABELS,
  BLOCK_TIER_LABELS,
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import { getLocationLabel, formatSealedAt, isSealedAtPending, getStatusBadgeVariant } from "@/lib/blocks";
import { BLOCK_HAS_PICK_HISTORY_MESSAGE } from "@/lib/blocks/pick-guard";
import { getAvailableTransitions } from "@/lib/blocks/lifecycle";
import { getBinUtilization } from "@/lib/location";
import { aggregateCardLinesForListing, toManaPoolCsv } from "@/lib/manapool/csv-export";
import { MoveBlockForm } from "../move-block-form";
import { RemoveBlockForm } from "../remove-block-form";
import { SealBlockForm } from "../seal-block-form";
import { BlockLifecycleSection } from "../block-lifecycle-section";
import { formatCurrency, formatDate, daysSince } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface BlockDetailPageProps {
  params: Promise<{ blockId: string }>;
}

export default async function BlockDetailPage({ params }: BlockDetailPageProps) {
  const { blockId } = await params;

  const block = await db.block.findUnique({
    where: { blockId },
    include: {
      bin: { include: { shelf: true } },
      cards: { orderBy: { position: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { pickItems: true } },
    },
  });

  if (!block) notFound();

  const bins = await getBinUtilization();
  const binOptions = bins.map((bin) => ({
    id: bin.id,
    binId: bin.binId,
    shelfCode: bin.shelf?.code ?? "Unassigned",
    used: bin.used,
  }));

  const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
  const estimatedValue = block.cards.reduce(
    (sum, c) => sum + (c.priceUsd ?? 0) * c.quantity,
    0,
  );
  const idleDays = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
  const listingRows = aggregateCardLinesForListing(block.cards);
  const csvPreview = listingRows.length > 0 ? toManaPoolCsv(listingRows) : null;
  const canSeal = block.status === "OPEN" && cardCount > 0;
  const sealedPending = isSealedAtPending(block);
  const hasPickHistory = block._count.pickItems > 0;
  const availableTransitions = getAvailableTransitions(block.status);

  return (
    <>
      <PageHeader
        title={block.blockId}
        description={block.label ?? "Chaos block detail"}
        action={
          <Link href="/blocks" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Back to blocks
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Status</p>
          <Badge variant={getStatusBadgeVariant(block.status)}>
            {BLOCK_STATUS_LABELS[block.status]}
          </Badge>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Location</p>
          <p className="mt-1 font-mono text-zinc-100">{getLocationLabel(block)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Cards / Value</p>
          <p className="mt-1 text-zinc-100">
            {cardCount.toLocaleString()} · {formatCurrency(estimatedValue)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500">Channel / Idle</p>
          <p className="mt-1 text-zinc-100">
            {BLOCK_CHANNEL_LABELS[block.channel]} ·{" "}
            {idleDays !== null ? `${idleDays}d` : "—"}
          </p>
        </div>
      </div>

      {csvPreview && (
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium text-zinc-100">Mana Pool listing export</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {listingRows.length} listing row(s). Edit prices in the CSV before importing to
                Mana Pool.
              </p>
            </div>
            <a
              href={`/api/blocks/${block.blockId}/export-csv`}
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950"
            >
              Download CSV
            </a>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium text-zinc-100">Contents</h2>
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Pos</th>
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium">Set</th>
                  <th className="px-4 py-3 font-medium">Cond / Finish / Lang</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {block.cards.map((card) => (
                  <tr key={card.id}>
                    <td className="px-4 py-3 font-mono text-zinc-400">{card.position}</td>
                    <td className="px-4 py-3">
                      <p className="text-zinc-100">{card.name}</p>
                      {card.isBulkLine && card.bulkDescription && (
                        <p className="text-xs text-zinc-500">{card.bulkDescription}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono uppercase text-zinc-400">{card.setCode}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {CONDITION_LABELS[card.condition]} / {FINISH_LABELS[card.finish]} /{" "}
                      {card.language.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{card.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          {canSeal && (
            <div>
              <h2 className="mb-4 text-lg font-medium text-zinc-100">Seal block</h2>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <SealBlockForm
                  blockId={block.blockId}
                  cardCount={cardCount}
                  targetCount={block.targetCount}
                />
              </div>
            </div>
          )}

          <BlockLifecycleSection
            blockId={block.blockId}
            status={block.status}
            availableTransitions={availableTransitions}
          />

          <div>
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Move block</h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <MoveBlockForm
                blockId={block.blockId}
                currentBinId={block.binId}
                bins={binOptions}
              />
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-medium text-red-200">Remove block</h2>
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
              <RemoveBlockForm
                blockId={block.blockId}
                cardCount={cardCount}
                statusLabel={BLOCK_STATUS_LABELS[block.status]}
                canRemove={!hasPickHistory}
                removeBlockedReason={
                  hasPickHistory ? BLOCK_HAS_PICK_HISTORY_MESSAGE : undefined
                }
              />
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Metadata</h2>
            <dl className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
              <div>
                <dt className="text-zinc-500">Tier</dt>
                <dd className="text-zinc-200">{BLOCK_TIER_LABELS[block.tier]}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Packed</dt>
                <dd className="text-zinc-200">{formatDate(block.packedAt)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Sealed</dt>
                <dd
                  className={
                    sealedPending ? "text-amber-400/90" : "text-zinc-200"
                  }
                >
                  {formatSealedAt(block)}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Activated (Mana Pool)</dt>
                <dd className="text-zinc-200">{formatDate(block.activatedAt)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Last pick</dt>
                <dd className="text-zinc-200">{formatDate(block.lastPickAt)}</dd>
              </div>
            </dl>
          </div>

          {block.auditLogs.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-medium text-zinc-100">Recent activity</h2>
              <ul className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
                {block.auditLogs.map((entry) => (
                  <li key={entry.id} className="text-zinc-400">
                    <span className="text-zinc-500">{formatDate(entry.createdAt)}</span>
                    {" · "}
                    <span className="text-zinc-300">{entry.action}</span>
                    {entry.details && (
                      <span className="text-zinc-400"> — {entry.details}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
