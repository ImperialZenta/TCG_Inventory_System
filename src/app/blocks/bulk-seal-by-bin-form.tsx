"use client";

import { useActionState } from "react";
import { sealBlocksByBinAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";
import type { SealSummary } from "@/lib/blocks/seal";

interface BinSealOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
  sealSummary: SealSummary;
}

interface BulkSealByBinFormProps {
  bins: BinSealOption[];
  defaultBinId?: string | null;
}

export function BulkSealByBinForm({ bins, defaultBinId }: BulkSealByBinFormProps) {
  const [result, formAction] = useActionState(sealBlocksByBinAction, null);
  const binsWithEligible = bins.filter((bin) => bin.sealSummary.eligible > 0);

  if (binsWithEligible.length === 0) {
    return null;
  }

  const defaultEligible =
    defaultBinId && binsWithEligible.some((bin) => bin.id === defaultBinId)
      ? defaultBinId
      : binsWithEligible[0].id;

  return (
    <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-lg font-medium text-zinc-100">Bulk seal by bin</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Seal every unsealed block with cards in the selected bin. Already sealed blocks are
        skipped.
      </p>
      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="mb-1 block text-zinc-400">Bin</span>
          <select
            name="binId"
            required
            defaultValue={defaultEligible}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            {binsWithEligible.map((bin) => (
              <option key={bin.id} value={bin.id}>
                {bin.binId} ({bin.shelfCode}) — {bin.sealSummary.eligible} unsealed
              </option>
            ))}
          </select>
        </label>
        <SubmitButton
          idleLabel="Seal all in bin"
          pendingLabel="Sealing…"
          successLabel="Sealed ✓"
          result={result}
          variant="primary"
        />
      </form>
    </section>
  );
}
