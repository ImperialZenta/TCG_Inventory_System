"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { SettingsActionResult } from "@/app/settings/actions";

interface SubmitButtonProps {
  idleLabel: string;
  pendingLabel?: string;
  successLabel?: string;
  result: SettingsActionResult | null;
  variant?: "primary" | "secondary" | "destructive";
  className?: string;
  disabled?: boolean;
}

function SubmitButtonInner({
  idleLabel,
  pendingLabel = "Saving…",
  successLabel = "Saved ✓",
  result,
  variant = "primary",
  className,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const [flash, setFlash] = useState<SettingsActionResult | null>(null);

  useEffect(() => {
    if (!result) return;

    setFlash(result);
    const ms = result.ok ? 2000 : 3000;
    const timer = setTimeout(() => setFlash(null), ms);
    return () => clearTimeout(timer);
  }, [result]);

  let label = idleLabel;
  if (pending) {
    label = pendingLabel;
  } else if (flash?.ok) {
    label = successLabel;
  } else if (flash && !flash.ok) {
    label = flash.message;
  }

  const isSuccess = !pending && flash?.ok;
  const isError = !pending && flash && !flash.ok;

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={cn(
        "min-w-[7rem] rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70",
        variant === "primary" && !isSuccess && !isError && "bg-amber-500 text-zinc-950 hover:bg-amber-400",
        variant === "secondary" && !isSuccess && !isError && "border border-zinc-600 text-zinc-200 hover:border-zinc-500",
        variant === "destructive" && !isSuccess && !isError && "bg-red-600 text-white hover:bg-red-500",
        isSuccess && "border border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
        isError && "border border-red-500/50 bg-red-500/15 text-red-300",
        className,
      )}
    >
      {label}
    </button>
  );
}

export function SubmitButton(props: SubmitButtonProps) {
  return <SubmitButtonInner {...props} />;
}
