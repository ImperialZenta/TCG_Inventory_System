"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  holdPickListAction,
  reallocatePickListAction,
  resumePickListAction,
} from "@/app/pick/actions";

interface PickListToolbarProps {
  pickListId: string;
  humanPickListId: string;
  status: string;
}

export function PickListToolbar({ pickListId, humanPickListId, status }: PickListToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {status !== "ON_HOLD" && status !== "COMPLETED" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                await holdPickListAction(pickListId, "Paused by picker");
                router.refresh();
              })
            }
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Hold list
          </button>
        )}
        {status === "ON_HOLD" && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await resumePickListAction(pickListId);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  router.refresh();
                })
              }
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              Resume
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await reallocatePickListAction(pickListId);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  router.refresh();
                })
              }
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Re-allocate
            </button>
            <Link
              href={`/pick/correction?pickListId=${pickListId}&label=${encodeURIComponent(humanPickListId)}`}
              className="rounded-lg border border-amber-700/50 px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-500/10"
            >
              Import correction
            </Link>
          </>
        )}
      </div>
      {error && (
        <p className="max-w-md whitespace-pre-wrap text-right text-xs text-amber-300">{error}</p>
      )}
    </div>
  );
}
