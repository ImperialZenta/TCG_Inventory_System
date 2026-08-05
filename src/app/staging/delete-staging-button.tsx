"use client";

import type { FormEvent } from "react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteStagingImportAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";

interface DeleteStagingButtonProps {
  importId: string;
  filename: string;
}

export function DeleteStagingButton({ importId, filename }: DeleteStagingButtonProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(deleteStagingImportAction, null);

  useEffect(() => {
    if (result?.ok) {
      router.push("/staging");
    }
  }, [result, router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `Delete staging for "${filename}"? You will need to re-upload the CSV to recreate it.`,
    );
    if (!confirmed) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <input type="hidden" name="importId" value={importId} />
      <SubmitButton
        idleLabel="Delete"
        pendingLabel="Deleting…"
        successLabel="Deleted ✓"
        result={result}
        variant="destructive"
        className="min-w-0 px-3 py-1.5 text-xs"
      />
    </form>
  );
}
