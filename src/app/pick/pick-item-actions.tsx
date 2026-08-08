"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/page-header";
import { PICK_STATUS_LABELS } from "@/lib/constants";
import { SHORT_REASON_LABELS, type ShortReason } from "@/lib/pick/types";
import {
  pickItemAction,
  shortPickItemAction,
  substitutePickItemAction,
  quarantineBlockAction,
  clearBlockHoldAction,
} from "@/app/pick/actions";

interface PickItemActionsProps {
  pickItemId: string;
  pickListId: string;
  mtgBlockId: string;
  status: string;
  blockOnHold: boolean;
  blockedReason?: string | null;
  alternatePositions?: { cardLineId: string; position: number; label: string }[];
}

export function PickItemActions({
  pickItemId,
  pickListId,
  mtgBlockId,
  status,
  blockOnHold,
  blockedReason = null,
  alternatePositions = [],
}: PickItemActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (status !== "PENDING") {
    return (
      <Badge variant={status === "PICKED" ? "success" : status === "SHORT" ? "warning" : "muted"}>
        {PICK_STATUS_LABELS[status] ?? status}
      </Badge>
    );
  }

  function runPick() {
    startTransition(async () => {
      try {
        await pickItemAction(pickItemId, pickListId);
        router.refresh();
      } catch {
        router.refresh();
      }
    });
  }

  function runShort(reason: ShortReason) {
    startTransition(async () => {
      await shortPickItemAction(pickItemId, pickListId, reason);
      router.refresh();
    });
  }

  function runSubstitute(cardLineId: string) {
    startTransition(async () => {
      await substitutePickItemAction(pickItemId, pickListId, cardLineId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={runPick}
        disabled={isPending || blockOnHold || Boolean(blockedReason)}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        Picked
      </button>
      {alternatePositions.length > 0 && (
        <select
          className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          defaultValue=""
          disabled={isPending || blockOnHold || Boolean(blockedReason)}
          onChange={(e) => {
            const value = e.target.value;
            if (value) runSubstitute(value);
            e.target.value = "";
          }}
        >
          <option value="">Substitute…</option>
          {alternatePositions.map((alt) => (
            <option key={alt.cardLineId} value={alt.cardLineId}>
              pos {alt.position} · {alt.label}
            </option>
          ))}
        </select>
      )}
      <select
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
        defaultValue=""
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value as ShortReason;
          if (value) runShort(value);
          e.target.value = "";
        }}
      >
        <option value="">Short…</option>
        {(Object.keys(SHORT_REASON_LABELS) as ShortReason[]).map((key) => (
          <option key={key} value={key}>
            {SHORT_REASON_LABELS[key]}
          </option>
        ))}
      </select>
      {blockOnHold ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await clearBlockHoldAction(mtgBlockId, pickListId);
              router.refresh();
            })
          }
          className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
        >
          Clear hold
        </button>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await quarantineBlockAction(mtgBlockId, pickListId, "Quarantined for picking");
              router.refresh();
            })
          }
          className="rounded-md border border-amber-700/50 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10"
        >
          Quarantine block
        </button>
      )}
    </div>
  );
}
