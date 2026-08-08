"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearQuarantineAction } from "@/app/blocks/actions";

export function ClearQuarantineButton({ mtgBlockId }: { mtgBlockId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await clearQuarantineAction(mtgBlockId);
          router.refresh();
        })
      }
      className="rounded-md border border-amber-700/50 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
    >
      {isPending ? "Clearing…" : "Clear quarantine"}
    </button>
  );
}
