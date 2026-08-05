"use client";

import { useActionState, useEffect, useState } from "react";
import { createBin } from "./actions";
import { SubmitButton } from "@/components/submit-button";

interface ShelfOption {
  id: string;
  code: string;
  label: string | null;
}

interface AddBinFormProps {
  shelves: ShelfOption[];
}

export function AddBinForm({ shelves }: AddBinFormProps) {
  const [result, formAction] = useActionState(createBin, null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (result?.ok) {
      setFormKey((k) => k + 1);
    }
  }, [result]);

  return (
    <form key={formKey} action={formAction} className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
      <h3 className="text-sm font-medium text-zinc-300">Add bin</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          name="shelfCode"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          required
        >
          <option value="">Select shelf</option>
          {shelves.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code} {s.label ? `— ${s.label}` : ""}
            </option>
          ))}
        </select>
        <input
          name="binId"
          placeholder="Bin ID (e.g. A-B03)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          required
        />
        <input
          name="label"
          placeholder="Label (optional)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 sm:col-span-2"
        />
      </div>
      <SubmitButton idleLabel="Add Bin" result={result} variant="primary" />
    </form>
  );
}
