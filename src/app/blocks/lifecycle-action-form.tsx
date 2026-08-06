"use client";

import { useActionState } from "react";
import { lifecycleBlockAction } from "@/app/blocks/actions";
import { SubmitButton } from "@/components/submit-button";
import { LIFECYCLE_TRANSITION_LABELS } from "@/lib/constants";
import type { LifecycleTransition } from "@/lib/blocks/lifecycle";

interface LifecycleActionFormProps {
  blockId: string;
  transition: LifecycleTransition;
}

export function LifecycleActionForm({ blockId, transition }: LifecycleActionFormProps) {
  const [result, formAction] = useActionState(lifecycleBlockAction, null);
  const labels = LIFECYCLE_TRANSITION_LABELS[transition];
  const isDestructive = transition === "LIQUIDATE";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="blockId" value={blockId} />
      <input type="hidden" name="transition" value={transition} />
      <p className="text-sm text-zinc-400">{labels.description}</p>
      <SubmitButton
        idleLabel={labels.button}
        pendingLabel={labels.pending}
        successLabel="Done ✓"
        result={result}
        variant={isDestructive ? "destructive" : "primary"}
      />
    </form>
  );
}
