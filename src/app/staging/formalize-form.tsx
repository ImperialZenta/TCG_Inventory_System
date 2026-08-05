"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formalizeStagingImportAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import type { StagingReviewGroup } from "@/lib/staging/review";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
}

interface FormalizeFormProps {
  importId: string;
  groups: StagingReviewGroup[];
  bins: BinOption[];
  alreadyAssigned: boolean;
}

export function FormalizeForm({
  importId,
  groups,
  bins,
  alreadyAssigned,
}: FormalizeFormProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(formalizeStagingImportAction, null);

  useEffect(() => {
    if (result?.ok) {
      const timer = setTimeout(() => router.push("/blocks"), 1500);
      return () => clearTimeout(timer);
    }
  }, [result, router]);

  if (alreadyAssigned) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        This import has been formalized into blocks.{" "}
        <Link href="/blocks" className="underline hover:text-emerald-100">
          View blocks
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="importId" value={importId} />

      {bins.length === 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Add at least one bin in Settings before formalizing blocks.
        </div>
      )}

      {groups.map((group) => (
        <section
          key={group.blockIndex}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-medium text-zinc-100">
                Block {group.blockIndex} of {groups.length}
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                {group.totalQuantity} cards · positions 1–{group.totalQuantity}
              </p>
            </div>
            <label className="min-w-[14rem] text-sm">
              <span className="mb-1 block text-zinc-400">Assign to bin</span>
              <select
                name={`bin_${group.blockIndex}`}
                required
                defaultValue=""
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="" disabled>
                  Select bin…
                </option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.binId} ({bin.shelfCode}) — {bin.used} block
                    {bin.used === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-amber-400 hover:text-amber-300">
              Show {group.lineCount} positions
            </summary>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm text-zinc-400">
              {group.cards.map((card) => (
                <li key={card.id} className="flex justify-between gap-4 border-b border-zinc-800/60 py-1">
                  <span className="truncate text-zinc-200">
                    <span className="mr-2 font-mono text-zinc-500">#{card.position ?? "—"}</span>
                    {card.name}
                    <span className="ml-2 text-zinc-500">{card.setCode.toUpperCase()}</span>
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {CONDITION_LABELS[card.condition]} · {FINISH_LABELS[card.finish]}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          idleLabel="Create blocks"
          pendingLabel="Creating…"
          successLabel="Created ✓"
          result={result}
          variant="primary"
          disabled={bins.length === 0}
        />
        <Link
          href="/staging"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600"
        >
          Back to staging
        </Link>
      </div>
    </form>
  );
}
