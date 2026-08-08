"use client";

import { useState } from "react";
import { Badge } from "@/components/page-header";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
  PICK_STATUS_LABELS,
} from "@/lib/constants";
import { SHORT_REASON_LABELS, type ShortReason } from "@/lib/pick/types";
import { PickItemActions } from "./pick-item-actions";

export interface PickGroupItem {
  id: string;
  status: string;
  shortReason: string | null;
  cardLine: { position: number; name: string; condition: string; finish: string } | null;
  externalOrderLine: {
    name: string;
    condition: string;
    finish: string;
  } | null;
  block: { pickHoldAt: Date | null; pickHoldReason: string | null } | null;
}

interface PickBlockGroupProps {
  blockId: string;
  mtgBlockId: string;
  locationLabel: string;
  items: PickGroupItem[];
  pickListId: string;
  alternatePositions: { cardLineId: string; position: number; label: string }[];
}

export function PickBlockGroup({
  mtgBlockId,
  locationLabel,
  items,
  pickListId,
  alternatePositions,
}: PickBlockGroupProps) {
  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const allResolved = pendingCount === 0;
  const [collapsed, setCollapsed] = useState(allResolved);

  const blockOnHold = Boolean(items[0]?.block?.pickHoldAt);
  const holdReason = items[0]?.block?.pickHoldReason;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/50 px-4 py-3 text-left hover:bg-zinc-900/80"
      >
        <div>
          <span className="font-mono font-medium text-zinc-100">{mtgBlockId}</span>
          <span className="ml-3 text-sm text-zinc-500">{locationLabel}</span>
          <span className="ml-3 text-xs text-zinc-600">
            {items.length - pendingCount}/{items.length} done
          </span>
        </div>
        <div className="flex items-center gap-2">
          {allResolved && <Badge variant="success">Complete</Badge>}
          {blockOnHold && (
            <Badge variant="warning">Pick hold · {holdReason ?? "Quarantined"}</Badge>
          )}
          <span className="text-xs text-zinc-500">{collapsed ? "Show" : "Hide"}</span>
        </div>
      </button>
      {!collapsed && (
        <ul className="divide-y divide-zinc-800">
          {items.map((item) => {
            const cardName =
              item.externalOrderLine?.name ?? item.cardLine?.name ?? "Unknown";
            const position = item.cardLine?.position;
            const condition =
              item.externalOrderLine?.condition ?? item.cardLine?.condition ?? "NM";
            const finish = item.externalOrderLine?.finish ?? item.cardLine?.finish ?? "NONFOIL";

            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-zinc-100">
                    {position != null && (
                      <span className="mr-2 font-mono text-amber-400/90">pos {position}</span>
                    )}
                    {cardName}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {CONDITION_LABELS[condition as keyof typeof CONDITION_LABELS]} ·{" "}
                    {FINISH_LABELS[finish as keyof typeof FINISH_LABELS]}
                    {item.status === "SHORT" && item.shortReason && (
                      <span className="ml-2 text-amber-400">
                        ·{" "}
                        {SHORT_REASON_LABELS[item.shortReason as ShortReason] ??
                          item.shortReason}
                      </span>
                    )}
                  </div>
                </div>
                <PickItemActions
                  pickItemId={item.id}
                  pickListId={pickListId}
                  mtgBlockId={mtgBlockId}
                  status={item.status}
                  blockOnHold={blockOnHold}
                  alternatePositions={alternatePositions.filter(
                    (alt) => alt.position !== position,
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
