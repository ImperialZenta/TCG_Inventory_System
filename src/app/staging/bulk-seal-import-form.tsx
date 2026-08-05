"use client";

import { useActionState } from "react";
import { sealBlocksByImportAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";
import type { SealSummary } from "@/lib/blocks/seal";

interface BulkSealImportFormProps {
  importId: string;
  sealSummary: SealSummary;
}

export function BulkSealImportForm({ importId, sealSummary }: BulkSealImportFormProps) {
  const [result, formAction] = useActionState(sealBlocksByImportAction, null);

  if (sealSummary.total === 0) {
    return null;
  }

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-medium text-zinc-100">Bulk seal</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Seal all blocks created from this import. Physical packs should match their positions
        before sealing.
      </p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 px-3 py-2">
          <dt className="text-zinc-500">Blocks from import</dt>
          <dd className="mt-1 font-mono text-zinc-100">{sealSummary.total}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 px-3 py-2">
          <dt className="text-zinc-500">Ready to seal</dt>
          <dd className="mt-1 font-mono text-amber-400">{sealSummary.eligible}</dd>
        </div>
        <div className="rounded-lg border border-zinc-800 px-3 py-2">
          <dt className="text-zinc-500">Already sealed</dt>
          <dd className="mt-1 font-mono text-zinc-300">{sealSummary.alreadySealed}</dd>
        </div>
      </dl>
      <form action={formAction} className="mt-4">
        <input type="hidden" name="importId" value={importId} />
        <SubmitButton
          idleLabel={
            sealSummary.eligible > 0
              ? `Seal ${sealSummary.eligible} block${sealSummary.eligible === 1 ? "" : "s"}`
              : "Nothing to seal"
          }
          pendingLabel="Sealing…"
          successLabel="Sealed ✓"
          result={result}
          variant="primary"
          disabled={sealSummary.eligible === 0}
        />
      </form>
      {sealSummary.eligible === 0 && sealSummary.total > 0 && (
        <p className="mt-2 text-sm text-zinc-500">All blocks from this import are already sealed.</p>
      )}
    </section>
  );
}
