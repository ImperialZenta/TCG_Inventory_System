"use client";

import { useActionState } from "react";
import { updateDefaultFormalizeBin } from "./actions";
import { SubmitButton } from "@/components/submit-button";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
}

interface DefaultBinFormProps {
  bins: BinOption[];
  defaultFormalizeBinId: string | null;
}

export function DefaultBinForm({ bins, defaultFormalizeBinId }: DefaultBinFormProps) {
  const [result, formAction] = useActionState(updateDefaultFormalizeBin, null);

  return (
    <form action={formAction} className="mt-4 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="defaultFormalizeBinId" className="text-xs text-zinc-500">
          Default bin when formalizing blocks
        </label>
        <select
          id="defaultFormalizeBinId"
          name="defaultFormalizeBinId"
          key={defaultFormalizeBinId ?? "none"}
          defaultValue={defaultFormalizeBinId ?? ""}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">None — choose per block</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.binId} ({bin.shelfCode}) — {bin.used} block{bin.used === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Pre-fills all blocks on the formalize review page. Override individual blocks there if
          needed.
        </p>
      </div>
      <SubmitButton idleLabel="Save" result={result} variant="primary" />
    </form>
  );
}
