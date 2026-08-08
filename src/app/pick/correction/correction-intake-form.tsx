"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  createCorrectionImportAction,
  type PickImportActionResult,
} from "../import-actions";

const initialState: PickImportActionResult = { ok: true, message: "" };

export function CorrectionIntakeForm() {
  const searchParams = useSearchParams();
  const pickListId = searchParams.get("pickListId") ?? "";
  const label = searchParams.get("label") ?? "";
  const [cards, setCards] = useState([{ name: "", setCode: "tst" }]);

  const [state, formAction, isPending] = useActionState(
    async (_prev: PickImportActionResult, formData: FormData) =>
      createCorrectionImportAction(formData),
    initialState,
  );

  function addRow() {
    setCards((rows) => [...rows, { name: "", setCode: "tst" }]);
  }

  return (
    <>
      <PageHeader
        title="Correction intake"
        description={`Re-enter cards pulled during a failed pick${label ? ` (${label})` : ""}. Cards formalize into a new block — not the quarantined source.`}
      />

      <Link
        href={pickListId ? `/pick/${pickListId}` : "/pick"}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Back to pick list
      </Link>

      <form
        action={formAction}
        className="max-w-2xl space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
      >
        <input type="hidden" name="pickListId" value={pickListId} />
        <input
          type="hidden"
          name="cards"
          value={JSON.stringify(cards.filter((c) => c.name.trim()))}
        />

        <div>
          <label htmlFor="sourceMtgBlockId" className="block text-sm text-zinc-400">
            Quarantined block ID (optional)
          </label>
          <input
            id="sourceMtgBlockId"
            name="sourceMtgBlockId"
            type="text"
            placeholder="MTG-0007"
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm text-zinc-400">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-zinc-400">Cards in hand</p>
          {cards.map((card, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Card name"
                value={card.name}
                onChange={(e) => {
                  const next = [...cards];
                  next[index] = { ...next[index]!, name: e.target.value };
                  setCards(next);
                }}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              />
              <input
                type="text"
                placeholder="Set"
                value={card.setCode}
                onChange={(e) => {
                  const next = [...cards];
                  next[index] = { ...next[index]!, setCode: e.target.value };
                  setCards(next);
                }}
                className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-amber-400 hover:text-amber-300"
          >
            + Add card
          </button>
        </div>

        <button
          type="submit"
          disabled={isPending || !pickListId}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create correction staging import"}
        </button>
        {!state.ok && state.message && (
          <p className="text-sm text-red-400">{state.message}</p>
        )}
      </form>
    </>
  );
}
