"use client";

import { useActionState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { importTcgplayerPullsheetAction, type PickImportActionResult } from "../import-actions";

const initialState: PickImportActionResult = { ok: true, message: "" };

export default function PickImportPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: PickImportActionResult, formData: FormData) =>
      importTcgplayerPullsheetAction(formData),
    initialState,
  );

  return (
    <>
      <PageHeader
        title="Import pullsheet"
        description="Upload a TCGplayer pullsheet CSV to generate a location-sorted pick list."
      />

      <Link href="/pick" className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-300">
        ← Back to pick lists
      </Link>

      <form
        action={formAction}
        className="max-w-lg space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6"
      >
        <div>
          <label htmlFor="pullsheet" className="block text-sm text-zinc-400">
            TCGplayer pullsheet CSV
          </label>
          <input
            id="pullsheet"
            name="pullsheet"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-2 block w-full text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:text-sm file:font-medium file:text-zinc-950"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {isPending ? "Importing…" : "Generate pick list"}
        </button>
        {!state.ok && state.message && (
          <p className="text-sm text-red-400">{state.message}</p>
        )}
      </form>
    </>
  );
}
