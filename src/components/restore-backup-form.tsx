"use client";

import { useActionState, useState } from "react";
import type { SettingsActionResult } from "@/app/settings/actions";
import { SubmitButton } from "@/components/submit-button";
import { parseBackupJson, summarizeBackup } from "@/lib/backup-parse";
import type { BackupSummary } from "@/lib/backup-types";

interface RestoreBackupFormProps {
  action: (
    prev: SettingsActionResult | null,
    formData: FormData,
  ) => Promise<SettingsActionResult>;
}

function formatExportedAt(iso: string) {
  if (!iso) return "Unknown date";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function RestoreBackupForm({ action }: RestoreBackupFormProps) {
  const [result, formAction] = useActionState(action, null);
  const [confirmation, setConfirmation] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const canSubmit = confirmation === "RESTORE" && fileName !== null && parseError === null;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setParseError(null);
    setFileName(file?.name ?? null);

    if (!file) return;

    try {
      const text = await file.text();
      const backup = parseBackupJson(text);
      setPreview(summarizeBackup(backup));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Invalid backup file");
    }
  }

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="mt-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4"
    >
      <h3 className="text-sm font-medium text-amber-200">Restore from backup</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Replaces all shelves, bins, blocks, cards, staging, and app settings with the backup file.
        Orders and pick history are not restored. Type <strong className="text-zinc-200">RESTORE</strong> to
        confirm.
      </p>

      <div className="mt-3 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-400">Backup JSON file</span>
          <input
            type="file"
            name="backup"
            accept=".json,application/json"
            required
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-100 hover:file:bg-zinc-600"
          />
        </label>

        {parseError && (
          <p className="text-sm text-red-300">{parseError}</p>
        )}

        {preview && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400">
            <p>
              <span className="text-zinc-300">Exported:</span> {formatExportedAt(preview.exportedAt)}
            </p>
            <p className="mt-1">
              {preview.shelfCount} shelves · {preview.binCount} bins · {preview.blockCount} blocks ·{" "}
              {preview.cardLineCount} card lines · {preview.stagingImportCount} staging imports
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-zinc-400">Confirmation</span>
            <input
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Type RESTORE to confirm"
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </label>
          <SubmitButton
            idleLabel="Restore backup"
            pendingLabel="Restoring…"
            successLabel="Restored ✓"
            result={result}
            variant="destructive"
            disabled={!canSubmit}
          />
        </div>
      </div>
    </form>
  );
}
