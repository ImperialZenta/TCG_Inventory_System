"use client";

import { useActionState } from "react";
import { sealBlockAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";

interface SealBlockFormProps {
  blockId: string;
  cardCount: number;
  targetCount: number | null;
}

export function SealBlockForm({ blockId, cardCount, targetCount }: SealBlockFormProps) {
  const [result, formAction] = useActionState(sealBlockAction, null);

  const belowTarget =
    targetCount != null && targetCount > 0 && cardCount < targetCount;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="blockId" value={blockId} />
      <p className="text-sm text-zinc-400">
        Lock this brick for picking. Contents and positions will be frozen.
      </p>
      {belowTarget && (
        <p className="text-sm text-amber-400/90">
          This block has {cardCount} card{cardCount === 1 ? "" : "s"} (target{" "}
          {targetCount}). You can still seal if the physical pack is complete.
        </p>
      )}
      <SubmitButton
        idleLabel="Seal block"
        pendingLabel="Sealing…"
        successLabel="Sealed ✓"
        result={result}
        variant="primary"
      />
    </form>
  );
}
