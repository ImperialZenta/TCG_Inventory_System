import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { roleCanPerform, PERMISSIONS } from "@/lib/auth/permissions";
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
import { getBlockRemovalEligibility } from "@/lib/blocks/removal-eligibility";
import { formatEventTypeLabel, listEventsForBlock } from "@/lib/events";
import { getAvailableTransitions } from "@/lib/blocks/lifecycle";
import { getBinUtilization } from "@/lib/location";
import { aggregateCardLinesForListing, toManaPoolCsv } from "@/lib/manapool/csv-export";
import { MoveBlockForm } from "../move-block-form";
import { RemoveBlockForm } from "../remove-block-form";
import { SealBlockForm } from "../seal-block-form";
import { BlockLifecycleSection } from "../block-lifecycle-section";
import { CounterPickForm } from "../counter-pick-form";
import { ClearQuarantineButton } from "../clear-quarantine-button";
import { sumLineValueCents, formatMoney } from "@/lib/money";
import { formatDate, daysSince } from "@/lib/utils";

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
      reservedUploadSession: { select: { id: true, sessionId: true, status: true } },
      _count: { select: { pickItems: true } },
    },
  });

  if (!block) notFound();

  const recentEvents = await listEventsForBlock(block.id, block.blockId, 10);

  const bins = await getBinUtilization();
  const binOptions = bins.map((bin) => ({
    id: bin.id,
    binId: bin.binId,
    shelfCode: bin.shelf?.code ?? "Unassigned",
    used: bin.used,
  }));

  const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
  const estimatedValueCents = sumLineValueCents(block.cards);
  const idleDays = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
  const listingRows = aggregateCardLinesForListing(block.cards);
  const csvPreview = listingRows.length > 0 ? toManaPoolCsv(listingRows) : null;
  const canSeal = block.status === "OPEN" && cardCount > 0;
  const sealedPending = isSealedAtPending(block);
  const removalEligibility = getBlockRemovalEligibility({
    status: block.status,
    pickItemCount: block._count.pickItems,
    reservedUploadSessionId: block.reservedUploadSessionId,
  });
  const availableTransitions = getAvailableTransitions(block.status);
  const reservedSessionDisplayId =
    block.reservedUploadSession &&
    (block.reservedUploadSession.status === "DRAFT" ||
      block.reservedUploadSession.status === "CSV_READY")
      ? block.reservedUploadSession.sessionId
      : null;

  const session = await getCurrentSession();
  const role = session?.role ?? null;
  const canSealBlock = canSeal && roleCanPerform(role, PERMISSIONS.BLOCK_SEAL);
  const canMoveBlock = roleCanPerform(role, PERMISSIONS.BLOCK_MOVE);
  const canRemoveBlock = roleCanPerform(role, PERMISSIONS.BLOCK_REMOVE);
  const canLifecycle = roleCanPerform(role, PERMISSIONS.BLOCK_LIFECYCLE);
  const canExportListing = roleCanPerform(role, PERMISSIONS.UPLOAD_SESSION_CREATE);

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
            {cardCount.toLocaleString()} · {formatMoney(estimatedValueCents)}
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

      {block.pickHoldAt && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div>
            <p className="font-medium text-amber-200">Quarantined for picking</p>
            <p>{block.pickHoldReason ?? "On pick hold"}</p>
          </div>
          <ClearQuarantineButton mtgBlockId={block.blockId} />
        </div>
      )}

      {reservedSessionDisplayId && (
        <div className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <p className="font-medium text-sky-200">Reserved in upload session</p>
          <p>
            This block is reserved in{" "}
            <Link
              href={`/uploads/${reservedSessionDisplayId}`}
              className="font-mono text-sky-300 hover:text-sky-200"
            >
              {reservedSessionDisplayId}
            </Link>
            . Complete or cancel the session to release it — per-block activation is disabled.
          </p>
        </div>
      )}

      {(block.status === "ACTIVE" || block.status === "SEALED") && !block.pickHoldAt && (
        <CounterPickForm
          mtgBlockId={block.blockId}
          positions={block.cards.map((c) => ({ position: c.position, name: c.name }))}
        />
      )}

      {csvPreview && canExportListing && (
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
          {canSealBlock && (
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

          {canLifecycle && (
            <BlockLifecycleSection
              blockId={block.blockId}
              status={block.status}
              availableTransitions={availableTransitions}
              reservedSessionDisplayId={reservedSessionDisplayId}
            />
          )}

          {canMoveBlock && (
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
          )}

          {canRemoveBlock && (
            <div>
              <h2 className="mb-4 text-lg font-medium text-red-200">Remove block</h2>
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                <RemoveBlockForm
                  blockId={block.blockId}
                  cardCount={cardCount}
                  statusLabel={BLOCK_STATUS_LABELS[block.status]}
                  canRemove={removalEligibility.allowed}
                  removeBlockedReason={removalEligibility.reason}
                  removeRemediation={removalEligibility.remediation}
                />
              </div>
            </div>
          )}

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

          {recentEvents.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium text-zinc-100">Recent activity</h2>
                <Link href="/activity" className="text-xs text-zinc-500 hover:text-zinc-300">
                  All activity →
                </Link>
              </div>
              <ul className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
                {recentEvents.map((entry) => (
                  <li key={entry.id} className="text-zinc-400">
                    <span className="text-zinc-500">{formatDate(entry.createdAt)}</span>
                    {" · "}
                    <span className="text-zinc-300">{formatEventTypeLabel(entry.eventType)}</span>
                    <span className="text-zinc-400"> — {entry.summary}</span>
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
