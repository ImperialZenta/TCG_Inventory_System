"use client";

import Link from "next/link";
import { useTransition } from "react";
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

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "ON_HOLD" && status !== "COMPLETED" && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
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
                await resumePickListAction(pickListId);
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
                await reallocatePickListAction(pickListId);
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
  );
}
