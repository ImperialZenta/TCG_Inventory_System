"use client";

import { useActionState, useState } from "react";
import type { SettingsActionResult } from "@/app/settings/actions";
import { SubmitButton } from "@/components/submit-button";

interface ConfirmDeleteFormProps {
  title: string;
  description: string;
  action: (
    prev: SettingsActionResult | null,
    formData: FormData,
  ) => Promise<SettingsActionResult>;
  submitLabel: string;
}

export function ConfirmDeleteForm({
  title,
  description,
  action,
  submitLabel,
}: ConfirmDeleteFormProps) {
  const [result, formAction] = useActionState(action, null);
  const [confirmation, setConfirmation] = useState("");

  const canSubmit = confirmation === "DELETE";

  return (
    <form
      action={formAction}
      className="rounded-lg border border-red-900/40 bg-red-950/20 p-4"
    >
      <h3 className="text-sm font-medium text-red-200">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="sr-only">Confirmation</span>
          <input
            name="confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="Type DELETE to confirm"
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </label>
        <SubmitButton
          idleLabel={submitLabel}
          pendingLabel="Deleting…"
          successLabel="Deleted ✓"
          result={result}
          variant="destructive"
          disabled={!canSubmit}
        />
      </div>
    </form>
  );
}
