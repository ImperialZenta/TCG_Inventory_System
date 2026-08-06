"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { undoFormalizeImportAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";
import type { ImportUndoSummary } from "@/lib/staging/undo-formalize";

interface UndoFormalizeFormProps {
  importId: string;
  filename: string;
  summary: ImportUndoSummary;
}

const MAX_VISIBLE_BLOCK_IDS = 10;

export function UndoFormalizeForm({ importId, filename, summary }: UndoFormalizeFormProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(undoFormalizeImportAction, null);
  const [confirmation, setConfirmation] = useState("");

  const canSubmit = summary.canUndo && confirmation === "UNDO";

  const visibleBlockIds = summary.blockIds.slice(0, MAX_VISIBLE_BLOCK_IDS);
  const hiddenBlockCount = Math.max(0, summary.blockIds.length - visibleBlockIds.length);

  useEffect(() => {
    if (result?.ok) {
      router.push("/staging");
    }
  }, [result, router]);

  return (
    <section id="undo-formalize" className="mb-8 rounded-xl border border-red-900/40 bg-red-950/20 p-6">
      <h2 className="text-lg font-medium text-red-200">Undo formalize</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Use when the <span className="text-zinc-300">whole export file</span> is wrong and all blocks
        from this import are still unsealed. Fix the file in your scanner app, then re-upload on
        Staging.
      </p>

      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
          <p className="font-medium text-zinc-300">Use undo when</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-500">
            <li>The entire import is wrong</li>
            <li>All blocks are still unsealed</li>
            <li>You have not started picking from these blocks</li>
          </ul>
        </div>
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
          <p className="font-medium text-zinc-300">Do not use undo when</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-500">
            <li>Only one brick is wrong but the scan is trusted</li>
            <li>Any block is sealed or listed</li>
            <li>A pick mismatch at the bin — repair the block instead</li>
          </ul>
        </div>
      </div>

      {summary.blockCount > 0 && (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-500">Blocks to remove</dt>
            <dd className="mt-1 font-mono text-zinc-100">{summary.blockCount}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 px-3 py-2">
            <dt className="text-zinc-500">Cards in inventory</dt>
            <dd className="mt-1 font-mono text-zinc-100">{summary.totalCards.toLocaleString()}</dd>
          </div>
          <div className="rounded-lg border border-zinc-800 px-3 py-2 sm:col-span-1">
            <dt className="text-zinc-500">MTG IDs</dt>
            <dd className="mt-1 font-mono text-xs text-zinc-300">
              {visibleBlockIds.join(", ")}
              {hiddenBlockCount > 0 && ` +${hiddenBlockCount} more`}
            </dd>
          </div>
        </dl>
      )}

      {!summary.canUndo && summary.blockReason && (
        <p className="mt-4 text-sm text-amber-400/90">{summary.blockReason}</p>
      )}

      <p className="mt-4 text-sm text-zinc-500">
        <Link href="/api/backup/export" className="text-amber-400 hover:text-amber-300">
          Download a backup
        </Link>{" "}
        before undoing. MTG IDs are not reused after removal.
      </p>

      <form action={formAction} className="mt-4 space-y-3">
        <input type="hidden" name="importId" value={importId} />
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-500">
            Type <span className="font-mono text-zinc-300">UNDO</span> to remove all blocks and
            delete this import ({filename})
          </span>
          <input
            name="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="UNDO"
            autoComplete="off"
            className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <SubmitButton
          idleLabel="Undo formalize"
          pendingLabel="Undoing…"
          successLabel="Undone ✓"
          result={result}
          variant="destructive"
          disabled={!canSubmit}
        />
      </form>
    </section>
  );
}
