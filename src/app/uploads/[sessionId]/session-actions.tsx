"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  cancelUploadSessionAction,
  completeUploadSessionAction,
  generateUploadSessionCsvAction,
  type UploadActionResult,
} from "@/app/uploads/actions";
import { Badge } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { formatDate } from "@/lib/utils";

interface SessionBlock {
  id: string;
  blockId: string;
  label: string | null;
  status: string;
  cardCount: number;
  listableRowCount: number;
  locationLabel: string;
}

interface SessionActionsProps {
  sessionId: string;
  status: string;
  csvGeneratedAt: Date | null;
  latestExport: {
    filename: string;
    rowCount: number;
    createdAt: Date;
  } | null;
  blocks: SessionBlock[];
  canComplete: boolean;
}

export function CompleteSessionConfirmPanel({
  sessionId,
  completeAction,
  completeResult,
  onBack,
}: {
  sessionId: string;
  completeAction: (payload: FormData) => void;
  completeResult: UploadActionResult | null;
  onBack: () => void;
}) {
  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
      <h3 className="font-medium text-emerald-200">Confirm complete</h3>
      <p className="mt-2 text-sm text-zinc-300">
        The app does not verify Mana Pool accepted this file. Confirm only after you have
        successfully uploaded the CSV at manapool.com. All session blocks will become Active on{" "}
        {sessionId}&apos;s channel.
      </p>
      <form action={completeAction} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="confirmed" value="true" />
        <SubmitButton
          idleLabel="Yes, mark all blocks active"
          pendingLabel="Completing…"
          successLabel="Completed ✓"
          result={completeResult}
        />
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Back
        </button>
      </form>
    </section>
  );
}

export function CsvReadySessionWarning({ csvGeneratedAt }: { csvGeneratedAt: Date | null }) {
  return (
    <p className="mt-3 text-sm text-amber-300/80">
      CSV was generated{csvGeneratedAt ? ` at ${formatDate(csvGeneratedAt)}` : ""}. Upload at
      manapool.com before completing. If you uploaded this CSV to Mana Pool, Mana Pool may already
      have been updated — cancelling here releases reservations in this app only.
    </p>
  );
}

export function SessionActions({
  sessionId,
  status,
  csvGeneratedAt,
  latestExport,
  blocks,
  canComplete,
}: SessionActionsProps) {
  const [generateResult, generateAction] = useActionState(generateUploadSessionCsvAction, null);
  const [completeResult, completeAction] = useActionState(completeUploadSessionAction, null);
  const [cancelResult, cancelAction] = useActionState(cancelUploadSessionAction, null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);

  const isOpen = status === "DRAFT" || status === "CSV_READY";
  const hasListable = blocks.some((b) => b.listableRowCount > 0);

  return (
    <div className="space-y-6">
      {isOpen && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-medium text-zinc-100">Actions</h2>

          {!hasListable && (
            <p className="mt-2 text-sm text-amber-300/90">
              No listable singles in this session — bulk-only blocks cannot generate a Mana Pool CSV.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            {(status === "DRAFT" || status === "CSV_READY") && (
              <form action={generateAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <SubmitButton
                  idleLabel={status === "CSV_READY" ? "Regenerate CSV" : "Generate CSV"}
                  pendingLabel="Generating…"
                  successLabel="Generated ✓"
                  result={generateResult as UploadActionResult | null}
                  disabled={!hasListable}
                />
              </form>
            )}

            {(status === "CSV_READY" || latestExport) && (
              <a
                href={`/api/uploads/${sessionId}/export-csv`}
                className="inline-flex items-center rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
              >
                Download CSV
              </a>
            )}

            {status === "CSV_READY" && canComplete && !showCompleteConfirm && (
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(true)}
                className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Complete session
              </button>
            )}

            {isOpen && (
              <form action={cancelAction}>
                <input type="hidden" name="sessionId" value={sessionId} />
                <SubmitButton
                  idleLabel="Cancel session"
                  pendingLabel="Cancelling…"
                  successLabel="Cancelled ✓"
                  result={cancelResult as UploadActionResult | null}
                  variant="secondary"
                />
              </form>
            )}
          </div>

          {status === "CSV_READY" && <CsvReadySessionWarning csvGeneratedAt={csvGeneratedAt} />}

          {latestExport && (
            <p className="mt-2 text-sm text-zinc-500">
              Latest export: {latestExport.filename} · {latestExport.rowCount} rows ·{" "}
              {formatDate(latestExport.createdAt)}
            </p>
          )}

          {(generateResult || completeResult || cancelResult) && (
            <p
              className={`mt-3 text-sm ${
                (generateResult ?? completeResult ?? cancelResult)?.ok
                  ? "text-emerald-300"
                  : "text-red-300"
              }`}
            >
              {(generateResult ?? completeResult ?? cancelResult)?.message}
            </p>
          )}
        </section>
      )}

      {showCompleteConfirm && status === "CSV_READY" && canComplete && (
        <CompleteSessionConfirmPanel
          sessionId={sessionId}
          completeAction={completeAction}
          completeResult={completeResult as UploadActionResult | null}
          onBack={() => setShowCompleteConfirm(false)}
        />
      )}

      <section className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Block</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Cards</th>
              <th className="px-4 py-3 font-medium text-right">Listable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {blocks.map((block) => (
              <tr key={block.id} className="bg-zinc-950/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/blocks/${block.blockId}`}
                    className="font-mono text-amber-400 hover:text-amber-300"
                  >
                    {block.blockId}
                  </Link>
                  {block.label && <p className="text-xs text-zinc-500">{block.label}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-zinc-400">{block.locationLabel}</td>
                <td className="px-4 py-3">
                  <Badge variant={block.status === "ACTIVE" ? "success" : "default"}>
                    {block.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right font-mono text-zinc-200">{block.cardCount}</td>
                <td className="px-4 py-3 text-right font-mono text-zinc-200">
                  {block.listableRowCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
