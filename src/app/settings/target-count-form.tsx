"use client";

import { useActionState } from "react";
import { updateDefaultTargetCount } from "./actions";
import { SubmitButton } from "@/components/submit-button";

interface TargetCountFormProps {
  targetCount: string;
}

export function TargetCountForm({ targetCount }: TargetCountFormProps) {
  const [result, formAction] = useActionState(updateDefaultTargetCount, null);

  return (
    <form action={formAction} className="mt-4 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor="targetCount" className="text-xs text-zinc-500">
          Target cards per block
        </label>
        <input
          id="targetCount"
          name="targetCount"
          type="number"
          min={1}
          key={targetCount}
          defaultValue={targetCount}
          className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <SubmitButton idleLabel="Save" result={result} variant="primary" />
    </form>
  );
}
