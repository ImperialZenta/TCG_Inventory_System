"use client";

import { useActionState, useEffect, useState } from "react";
import { createShelf } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export function AddShelfForm() {
  const [result, formAction] = useActionState(createShelf, null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    if (result?.ok) {
      setFormKey((k) => k + 1);
    }
  }, [result]);

  return (
    <form key={formKey} action={formAction} className="mt-6 space-y-3 border-t border-zinc-800 pt-6">
      <h3 className="text-sm font-medium text-zinc-300">Add shelf</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="code"
          placeholder="Shelf code (e.g. A)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          required
        />
        <input
          name="label"
          placeholder="Label (optional)"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <SubmitButton idleLabel="Add Shelf" result={result} variant="primary" />
    </form>
  );
}
