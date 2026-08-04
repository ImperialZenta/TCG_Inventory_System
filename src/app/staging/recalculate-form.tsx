"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { recalculateBreakdownAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";

interface RecalculateBreakdownFormProps {
  importId: string;
  targetCount: number;
  disabled?: boolean;
}

export function RecalculateBreakdownForm({
  importId,
  targetCount,
  disabled = false,
}: RecalculateBreakdownFormProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(recalculateBreakdownAction, null);

  useEffect(() => {
    if (result?.ok) {
      router.refresh();
    }
  }, [result, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="importId" value={importId} />
      <label className="text-sm">
        <span className="mb-1 block text-zinc-400">Target cards per block</span>
        <input
          name="targetCount"
          type="number"
          min={1}
          defaultValue={targetCount}
          disabled={disabled}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:w-40"
        />
      </label>
      <SubmitButton
        idleLabel="Recalculate"
        pendingLabel="Updating…"
        successLabel="Updated ✓"
        result={result}
        variant="secondary"
        disabled={disabled}
      />
    </form>
  );
}
