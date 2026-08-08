"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { counterPickAction } from "@/app/blocks/actions";

interface CounterPickFormProps {
  mtgBlockId: string;
  positions: { position: number; name: string }[];
}

export function CounterPickForm({ mtgBlockId, positions }: CounterPickFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (positions.length === 0) {
    return null;
  }

  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const position = Number((form.elements.namedItem("position") as HTMLSelectElement).value);
        startTransition(async () => {
          await counterPickAction(mtgBlockId, position);
          router.refresh();
        });
      }}
    >
      <div>
        <label htmlFor="counter-position" className="block text-xs text-zinc-500">
          Counter pick — position
        </label>
        <select
          id="counter-position"
          name="position"
          disabled={isPending}
          className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200"
        >
          {positions.map((p) => (
            <option key={p.position} value={p.position}>
              pos {p.position} · {p.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {isPending ? "Pulling…" : "Counter pick"}
      </button>
    </form>
  );
}
