"use client";

import { useActionState } from "react";
import { backfillPricesAction, type BackfillActionResult } from "./pricing-actions";

const initialState: BackfillActionResult | null = null;

export function BackfillPricesForm() {
  const [state, formAction, pending] = useActionState(backfillPricesAction, initialState);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <p className="text-sm text-zinc-400">
        Re-fetch market prices from Scryfall for card lines that have no price. Unresolved lines
        are reported — nothing is silently skipped.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Backfilling…" : "Backfill card prices"}
      </button>

      {state && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            state.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-500/30 bg-red-500/10 text-red-200"
          }`}
        >
          <p>{state.message}</p>
          {state.ok && state.unresolved.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-300">
              {state.unresolved.map((item) => (
                <li key={item.cardLineId}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
