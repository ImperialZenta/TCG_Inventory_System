"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { importFixtureAction, type ActionResult } from "@/app/orders/actions";
import { SubmitButton } from "@/components/submit-button";

export function ImportFixtureForm() {
  const router = useRouter();
  const [result, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => {
      const res = await importFixtureAction(formData);
      if (res.ok) router.refresh();
      return res;
    },
    null,
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-400">Fixture JSON (see docs/fixtures/)</span>
        <input
          type="file"
          name="fixture"
          accept=".json,application/json"
          required
          className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-600"
        />
      </label>
      <SubmitButton
        idleLabel="Import fixture"
        pendingLabel="Importing…"
        result={result}
        variant="secondary"
        disabled={isPending}
      />
      {result && !result.ok && (
        <p className="text-sm text-red-300">{result.message}</p>
      )}
      {result?.ok && <p className="text-sm text-emerald-300">{result.message}</p>}
    </form>
  );
}
