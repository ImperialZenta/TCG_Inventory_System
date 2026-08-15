"use client";

import { useActionState, useState } from "react";
import { lifecycleBlockAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL,
  MANAPOOL_DELIST_HONESTY_COPY,
  MANAPOOL_DELIST_PLAYBOOK_STEPS,
} from "@/lib/blocks/mana-pool-delist-playbook";
import { LIFECYCLE_TRANSITION_LABELS } from "@/lib/constants";
import type { LifecycleTransition } from "@/lib/blocks/lifecycle";

interface LifecycleActionFormProps {
  blockId: string;
  transition: LifecycleTransition;
  requiresManaPoolDelistPlaybook?: boolean;
}

export function LifecycleActionForm({
  blockId,
  transition,
  requiresManaPoolDelistPlaybook = false,
}: LifecycleActionFormProps) {
  const [result, formAction] = useActionState(lifecycleBlockAction, null);
  const [acknowledged, setAcknowledged] = useState(false);
  const labels = LIFECYCLE_TRANSITION_LABELS[transition];
  const isDestructive = transition === "LIQUIDATE";
  const showPlaybook = transition === "ARCHIVE" && requiresManaPoolDelistPlaybook;
  const canSubmit = !showPlaybook || acknowledged;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="transition" value={transition} />
      {showPlaybook && acknowledged && <input type="hidden" name="confirmed" value="true" />}
      <p className="text-sm text-zinc-400">{labels.description}</p>
      {showPlaybook && (
        <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-amber-200">Manual Mana Pool delist required</p>
          <p className="text-sm text-zinc-300">{MANAPOOL_DELIST_HONESTY_COPY}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            {MANAPOOL_DELIST_PLAYBOOK_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 rounded border-zinc-600 bg-zinc-950"
            />
            <span>{MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL}</span>
          </label>
        </div>
      )}
      <SubmitButton
        idleLabel={labels.button}
        pendingLabel={labels.pending}
        successLabel="Done ✓"
        result={result}
        variant={isDestructive ? "destructive" : "primary"}
        disabled={!canSubmit}
      />
    </form>
  );
}
