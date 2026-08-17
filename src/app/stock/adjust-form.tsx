"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { MANUAL_STOCK_ADJUSTMENT_REASON_LABELS } from "@/lib/constants";
import { adjustStockQuantityAction, type StockActionResult } from "./actions";

interface AdjustStockFormProps {
  stockItemId: string;
  currentOnHand: number;
}

export function AdjustStockForm({ stockItemId, currentOnHand }: AdjustStockFormProps) {
  const [result, formAction] = useActionState<StockActionResult | null, FormData>(
    adjustStockQuantityAction,
    null,
  );

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
        Adjust quantity
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        Set a new on-hand count. Reserved quantity cannot exceed the new total.
      </p>

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-4">
        <input type="hidden" name="stockItemId" value={stockItemId} />

        <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Target on-hand
          <input
            type="number"
            name="targetOnHand"
            min={0}
            step={1}
            defaultValue={currentOnHand}
            required
            className="mt-2 block w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        <label className="block min-w-[10rem] text-xs font-medium uppercase tracking-wide text-zinc-500">
          Reason
          <select
            name="reason"
            required
            defaultValue=""
            className="mt-2 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="" disabled>
              Select reason…
            </option>
            {Object.entries(MANUAL_STOCK_ADJUSTMENT_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <SubmitButton
          idleLabel="Apply adjustment"
          pendingLabel="Saving…"
          successLabel="Updated ✓"
          result={result}
        />
      </form>

      {result && !result.ok && (
        <p className="mt-3 text-sm text-red-300">{result.message}</p>
      )}
    </section>
  );
}
