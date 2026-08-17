"use client";

import { useActionState } from "react";
import { resolveIncidentAction } from "@/app/incidents/actions";
import type { AlternateStockOption, PromotableCardLineOption } from "@/lib/channels/availability";

const RESOLUTIONS = [
  { value: "FULFILLED_ALT", label: "Fulfilled from alternate stock" },
  { value: "PROMOTED", label: "Promoted from chaos block" },
  { value: "CANCELLED_REFUND", label: "Cancelled with refund" },
] as const;

interface ResolveIncidentFormProps {
  incidentId: string;
  alternateStockItems: AlternateStockOption[];
  promotableCardLines: PromotableCardLineOption[];
}

export function ResolveIncidentForm({
  incidentId,
  alternateStockItems,
  promotableCardLines,
}: ResolveIncidentFormProps) {
  const [result, formAction] = useActionState(
    async (_prev: { ok: boolean; message: string } | null, formData: FormData) =>
      resolveIncidentAction(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="incidentId" value={incidentId} />
      <div>
        <label htmlFor="resolution" className="block text-sm text-zinc-400">
          Resolution
        </label>
        <select
          id="resolution"
          name="resolution"
          required
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Select…</option>
          {RESOLUTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="alternateStockItemId" className="block text-sm text-zinc-400">
          Alternate stock copy
          <span className="ml-1 text-zinc-500">(for Fulfilled from alternate stock)</span>
        </label>
        {alternateStockItems.length === 0 ? (
          <p className="mt-1 text-sm text-amber-300">
            No alternate sellable copies with available quantity.
          </p>
        ) : (
          <select
            id="alternateStockItemId"
            name="alternateStockItemId"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Select alternate copy…</option>
            {alternateStockItems.map((item) => (
              <option key={item.stockItemId} value={item.stockItemId}>
                {item.label}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="cardLineId" className="block text-sm text-zinc-400">
          Chaos block card to promote
          <span className="ml-1 text-zinc-500">(for Promoted from chaos block)</span>
        </label>
        {promotableCardLines.length === 0 ? (
          <p className="mt-1 text-sm text-amber-300">
            No promotable chaos copies for this printing. Check Inventory → Promotable from chaos.
          </p>
        ) : (
          <select
            id="cardLineId"
            name="cardLineId"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Select card line…</option>
            {promotableCardLines.map((line) => (
              <option key={line.cardLineId} value={line.cardLineId}>
                {line.name} · {line.mtgBlockId} · qty {line.quantity}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label htmlFor="note" className="block text-sm text-zinc-400">
          Note (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <button
        type="submit"
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
      >
        Resolve incident
      </button>
      {result && (
        <p className={`text-sm ${result.ok ? "text-emerald-400" : "text-red-400"}`}>{result.message}</p>
      )}
    </form>
  );
}
