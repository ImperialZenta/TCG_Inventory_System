import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { STAGING_IMPORT_STATUS_LABELS } from "@/lib/constants";
import { getBinUtilization } from "@/lib/location";
import {
  buildStagingReviewGroups,
  getQtyGroupWarnings,
} from "@/lib/staging/review";
import { buildImportAssignmentSummary } from "@/lib/staging/assignment-summary";
import { getLinkedBlocks } from "@/lib/staging/linked-blocks";
import { FormalizeForm } from "../formalize-form";
import { RecalculateBreakdownForm } from "../recalculate-form";
import { DeleteStagingButton } from "../delete-staging-button";
import { AssignmentBreakdown } from "../assignment-breakdown";
import { formatDate } from "@/lib/utils";
import { getDefaultFormalizeBinId } from "@/lib/staging/defaults";
import { getImportSealSummary } from "@/lib/blocks/seal";
import { getImportUndoSummary } from "@/lib/staging/undo-formalize";
import { BulkSealImportForm } from "../bulk-seal-import-form";
import { UndoFormalizeForm } from "../undo-formalize-form";
import { RemoveBlockFlash } from "../remove-block-flash";
export const dynamic = "force-dynamic";

interface StagingImportPageProps {
  params: Promise<{ importId: string }>;
  searchParams: Promise<{ removedBlock?: string; cardsRemoved?: string; lastBlock?: string }>;
}

export default async function StagingImportPage({ params, searchParams }: StagingImportPageProps) {
  const { importId } = await params;
  const query = await searchParams;
  const removedBlock = query.removedBlock?.trim();
  const cardsRemoved = query.cardsRemoved ? Number.parseInt(query.cardsRemoved, 10) : 0;
  const lastBlockRemoved = query.lastBlock === "1";

  const [stagingImport, bins, defaultBinId, importSealSummary, importUndoSummary, linkedBlocks] =
    await Promise.all([
    db.stagingImport.findUnique({
      where: { id: importId },
      include: {
        cards: { orderBy: [{ sourceRow: "asc" }, { expansionIndex: "asc" }] },
      },
    }),
    getBinUtilization(),
    getDefaultFormalizeBinId(),
    getImportSealSummary(importId),
    getImportUndoSummary(importId),
    getLinkedBlocks(importId),
  ]);

  if (!stagingImport) {
    notFound();
  }

  const groups = buildStagingReviewGroups(stagingImport.cards);
  const totalCards = stagingImport.cards.reduce((sum, c) => sum + c.quantity, 0);
  const alreadyAssigned = stagingImport.status === "ASSIGNED";
  const assignmentSummary = alreadyAssigned
    ? buildImportAssignmentSummary(stagingImport.cards, linkedBlocks)
    : null;
  const statusLabel =
    STAGING_IMPORT_STATUS_LABELS[stagingImport.status] ?? stagingImport.status;
  const { adjacencyReminders, crossBlockSplits } = getQtyGroupWarnings(stagingImport.cards);

  const binOptions = bins.map((bin) => ({
    id: bin.id,
    binId: bin.binId,
    shelfCode: bin.shelf?.code ?? "Unassigned",
    used: bin.used,
  }));

  return (
    <>
      <PageHeader
        title="Review staging"
        description={stagingImport.filename}
        action={
          <Link href="/staging" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Staging
          </Link>        }
      />

      {!alreadyAssigned && (
        <p className="mb-6 text-sm text-zinc-500">
          Assign bins, then formalize to receive MTG block IDs for team bag labels. Set a default
          bin in Settings to formalize large imports in one step — override individual blocks on
          this page if needed.
        </p>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Status</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{statusLabel}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Total cards</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{totalCards}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">
            {alreadyAssigned ? "In inventory" : "Suggested blocks"}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-100">
            {alreadyAssigned && assignmentSummary
              ? `${assignmentSummary.inBlockUnits} · ${assignmentSummary.blocks.length} block${assignmentSummary.blocks.length === 1 ? "" : "s"}`
              : groups.length}
          </p>
          {alreadyAssigned && assignmentSummary && assignmentSummary.unassignedUnits > 0 && (
            <p className="mt-0.5 text-xs text-amber-400">
              {assignmentSummary.unassignedUnits} unassigned
            </p>
          )}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Imported</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{formatDate(stagingImport.createdAt)}</p>
        </div>
      </div>

      {removedBlock && (
        <RemoveBlockFlash
          removedBlock={removedBlock}
          cardsRemoved={Number.isFinite(cardsRemoved) ? cardsRemoved : 0}
          lastBlock={lastBlockRemoved}
          importStillFormalized={alreadyAssigned}
        />
      )}

      {!alreadyAssigned && adjacencyReminders.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">
            Duplicate quantity detected — pack copies adjacent in the brick
          </p>
          <p className="mt-1 text-amber-100/80">
            Mana Box collapsed these into one CSV row. Positions below are consecutive; place those
            physical copies next to each other when packing.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-100/90">
            {adjacencyReminders.map((group) => (
              <li key={group.sourceRow}>
                {group.count}× {group.name} — {group.placements.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!alreadyAssigned && crossBlockSplits.length > 0 && (
        <div className="mb-6 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          <p className="font-medium text-sky-200">Quantity group split across blocks</p>
          <p className="mt-1 text-sky-100/80">
            Block size is hard-capped at the target count, so some duplicate groups span more than
            one block. Pack each block’s listed positions; adjacency is only within that block.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sky-100/90">
            {crossBlockSplits.map((group) => (
              <li key={group.sourceRow}>
                {group.count}× {group.name} — {group.placements.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!alreadyAssigned && (
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Block breakdown</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Cards are split into blocks by target count (hard cap). Position 1 is the front card
            facing you. Pack the physical stack to match CSV order after expanding quantities.
          </p>
          <div className="mt-4">
            <RecalculateBreakdownForm
              importId={stagingImport.id}
              targetCount={stagingImport.targetCount ?? 50}
            />
          </div>
        </section>
      )}

      {alreadyAssigned && assignmentSummary && (
        <AssignmentBreakdown summary={assignmentSummary} />
      )}

      {alreadyAssigned && (
        <BulkSealImportForm importId={stagingImport.id} sealSummary={importSealSummary} />
      )}

      {alreadyAssigned && (
        <UndoFormalizeForm
          importId={stagingImport.id}
          filename={stagingImport.filename}
          summary={importUndoSummary}
        />
      )}

      <FormalizeForm
        importId={stagingImport.id}
        groups={groups}
        bins={binOptions}
        defaultBinId={defaultBinId}
        alreadyAssigned={alreadyAssigned}
        formalizedBlockIds={alreadyAssigned ? importUndoSummary.blockIds : undefined}
      />

      {!alreadyAssigned && (
        <section className="mt-8 rounded-xl border border-red-900/40 bg-red-950/10 p-6">
          <h2 className="text-sm font-medium text-red-200">Discard staging</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Remove this import without creating blocks. You will need to re-upload the CSV to start
            over.
          </p>
          <div className="mt-3">
            <DeleteStagingButton
              importId={stagingImport.id}
              filename={stagingImport.filename}
            />
          </div>
        </section>
      )}    </>
  );
}
