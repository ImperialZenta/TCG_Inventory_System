"use client";

import { useActionState, useState } from "react";
import { removeBlockAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";

interface RemoveBlockFormProps {
  blockId: string;
  cardCount: number;
  statusLabel: string;
  canRemove: boolean;
  removeBlockedReason?: string;
  removeRemediation?: string;
}

export function RemoveBlockForm({
  blockId,
  cardCount,
  statusLabel,
  canRemove,
  removeBlockedReason,
  removeRemediation,
}: RemoveBlockFormProps) {
  const [result, formAction] = useActionState(removeBlockAction, null);
  const [confirmation, setConfirmation] = useState("");

  const canSubmit = canRemove && confirmation === blockId;

  if (!canRemove) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-zinc-400">
          Permanently delete this block and its {cardCount.toLocaleString()} card
          {cardCount === 1 ? "" : "s"} ({statusLabel}). This cannot be undone.
        </p>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {removeBlockedReason ??
            "Remove is not available for this block. Complete or cancel related picks first."}
        </p>
        {removeRemediation && (
          <p className="text-xs text-zinc-400">{removeRemediation}</p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="blockId" value={blockId} />
      <p className="text-sm text-zinc-400">
        Permanently delete this block and its {cardCount.toLocaleString()} card
        {cardCount === 1 ? "" : "s"} ({statusLabel}). This cannot be undone.
      </p>
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-500">
          Type <span className="font-mono text-zinc-300">{blockId}</span> to confirm
        </span>
        <input
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={blockId}
          autoComplete="off"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
        />
      </label>
      <SubmitButton
        idleLabel="Remove block"
        pendingLabel="Removing…"
        successLabel="Removed ✓"
        result={result}
        variant="destructive"
        disabled={!canSubmit}
      />
    </form>
  );
}
