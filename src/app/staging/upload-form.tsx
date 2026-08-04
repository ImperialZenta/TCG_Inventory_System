"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { uploadStagingCsv } from "@/app/staging/actions";

export function StagingUploadForm() {
  const [result, formAction] = useActionState(uploadStagingCsv, null);

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-zinc-400">ManaBox CSV file</span>
        <input
          type="file"
          name="csv"
          accept=".csv,text/csv"
          required
          className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-950 hover:file:bg-amber-400"
        />
      </label>
      <SubmitButton
        idleLabel="Upload and breakdown"
        pendingLabel="Uploading…"
        successLabel="Uploaded ✓"
        result={result}
        variant="primary"
      />
    </form>
  );
}
