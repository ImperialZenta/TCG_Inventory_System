"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "@/components/submit-button";
import { StagingActivityLog } from "@/components/staging-activity-log";
import { uploadStagingCsv } from "@/app/staging/actions";
import type { StagingLogEntry } from "@/lib/staging/upload-log";

function clientLog(message: string, level: StagingLogEntry["level"] = "info"): StagingLogEntry {
  return { at: new Date().toISOString(), level, message };
}

export function StagingUploadForm() {
  const router = useRouter();
  const [result, formAction, isPending] = useActionState(uploadStagingCsv, null);
  const [entries, setEntries] = useState<StagingLogEntry[]>([]);
  const autoNavRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoNav = useCallback(() => {
    if (autoNavRef.current) {
      clearTimeout(autoNavRef.current);
      autoNavRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!result) return;

    setEntries((prev) => [...prev, ...result.log]);

    if (result.ok) {
      autoNavRef.current = setTimeout(() => {
        router.push(`/staging/${result.importId}`);
      }, 8000);
    }

    return clearAutoNav;
  }, [result, router, clearAutoNav]);

  useEffect(() => () => clearAutoNav(), [clearAutoNav]);

  function handleSubmit(formData: FormData) {
    clearAutoNav();
    const file = formData.get("csv");
    const fileName = file instanceof File ? file.name : "unknown";
    setEntries([
      clientLog(`Upload started: ${fileName}`),
      clientLog("Sending file to server…"),
    ]);
    formAction(formData);
  }

  const summary = result?.ok ? result.summary : null;
  const importId = result?.ok ? result.importId : null;
  const errorMessage = result && !result.ok ? result.message : null;

  return (
    <div className="space-y-4">
      <form action={handleSubmit} encType="multipart/form-data" className="space-y-3">
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
          successLabel="Processing…"
          result={null}
          variant="primary"
          disabled={isPending}
        />
      </form>

      {errorMessage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <StagingActivityLog entries={entries} summary={summary} importId={importId} />
    </div>
  );
}
