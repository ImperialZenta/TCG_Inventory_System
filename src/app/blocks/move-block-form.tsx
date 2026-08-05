"use client";

import { useActionState } from "react";
import { moveBlockToBin } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
}

interface MoveBlockFormProps {
  blockId: string;
  currentBinId: string | null;
  bins: BinOption[];
}

export function MoveBlockForm({ blockId, currentBinId, bins }: MoveBlockFormProps) {
  const [result, formAction] = useActionState(moveBlockToBin, null);

  if (bins.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Add a bin in Settings to assign this block to storage.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="blockId" value={blockId} />
      <label className="min-w-[14rem] flex-1 text-sm">
        <span className="mb-1 block text-zinc-400">Bin</span>
        <select
          name="binId"
          required
          defaultValue={currentBinId ?? ""}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          {!currentBinId && (
            <option value="" disabled>
              Select bin…
            </option>
          )}
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.binId} ({bin.shelfCode}) — {bin.used} block{bin.used === 1 ? "" : "s"}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton
        idleLabel="Move block"
        pendingLabel="Moving…"
        successLabel="Moved ✓"
        result={result}
        variant="secondary"
      />
    </form>
  );
}
