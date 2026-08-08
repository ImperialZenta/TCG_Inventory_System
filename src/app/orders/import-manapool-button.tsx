"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importFromManaPoolAction } from "@/app/orders/actions";

interface ImportManaPoolButtonProps {
  disabled: boolean;
  disabledReason?: string;
}

export function ImportManaPoolButton({ disabled, disabledReason }: ImportManaPoolButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  function handleClick() {
    startTransition(async () => {
      const result = await importFromManaPoolAction();
      setOk(result.ok);
      setMessage(result.message);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Importing…" : "Import from Mana Pool"}
      </button>
      {disabled && disabledReason && (
        <p className="text-xs text-zinc-500">{disabledReason}</p>
      )}
      {message && (
        <p className={`text-sm ${ok ? "text-emerald-300" : "text-red-300"}`}>{message}</p>
      )}
    </div>
  );
}
