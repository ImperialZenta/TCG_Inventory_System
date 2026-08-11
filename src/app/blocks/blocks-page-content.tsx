"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { bulkMoveBlocksAction, type BlockActionResult } from "@/app/blocks/actions";
import { Badge, EmptyState } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { BulkSealByBinForm } from "./bulk-seal-by-bin-form";
import {
  BLOCK_CHANNEL_LABELS,
  BLOCK_STATUS_LABELS,
} from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { formatDate, daysSince } from "@/lib/utils";
import type { SealSummary } from "@/lib/blocks/seal";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
  sealSummary?: SealSummary;
}

interface BlockRow {
  id: string;
  blockId: string;
  label: string | null;
  status: string;
  channel: string;
  cardCount: number;
  estimatedValueCents: number;
  lastPickAt: Date | null;
  sealedAt: Date | null;
  packedAt: Date;
  pickHoldAt: Date | null;
  reservedSessionDisplayId: string | null;
  locationLabel: string;
  sealedAtLabel: string;
  sealedAtPending: boolean;
  statusVariant: "default" | "warning" | "success" | "muted";
}

interface BlocksPageContentProps {
  blocks: BlockRow[];
  binOptions: BinOption[];
  defaultFormalizeBinId: string | null;
}

export function BlocksPageContent({
  blocks,
  binOptions,
  defaultFormalizeBinId,
}: BlocksPageContentProps) {
  const [result, formAction] = useActionState(bulkMoveBlocksAction, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"selection" | "bin">("selection");

  const toggle = (blockId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const binsWithBlocks = binOptions.filter((b) => b.used > 0);

  if (blocks.length === 0) {
    return (
      <EmptyState
        title="No blocks yet"
        description="Configure shelves in Settings, then import staging cards to create blocks."
        action={
          <Link
            href="/settings"
            className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950"
          >
            Open Settings
          </Link>
        }
      />
    );
  }

  return (
    <>
      <BulkSealByBinForm
        bins={binOptions.filter((b) => b.sealSummary).map((b) => ({
          ...b,
          sealSummary: b.sealSummary!,
        }))}
        defaultBinId={defaultFormalizeBinId}
      />

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Bulk block transfer</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Move selected blocks or every block in a bin. Each move writes an activity event.
        </p>

        <div className="mt-4 flex gap-4 text-sm">
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="radio"
              checked={mode === "selection"}
              onChange={() => setMode("selection")}
            />
            Selected blocks ({selected.size})
          </label>
          <label className="flex items-center gap-2 text-zinc-300">
            <input type="radio" checked={mode === "bin"} onChange={() => setMode("bin")} />
            Entire bin
          </label>
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="mode" value={mode} />
          {[...selected].map((blockId) => (
            <input key={blockId} type="hidden" name="blockIds" value={blockId} />
          ))}

          {mode === "bin" && (
            <label className="min-w-[14rem] flex-1 text-sm">
              <span className="mb-1 block text-zinc-400">Source bin</span>
              <select
                name="sourceBinId"
                required
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="" disabled>
                  Select source bin…
                </option>
                {binsWithBlocks.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.binId} ({bin.shelfCode}) — {bin.used} blocks
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="min-w-[14rem] flex-1 text-sm">
            <span className="mb-1 block text-zinc-400">Destination bin</span>
            <select
              name="targetBinId"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="" disabled>
                Select destination…
              </option>
              {binOptions.map((bin) => (
                <option key={bin.id} value={bin.id}>
                  {bin.binId} ({bin.shelfCode})
                </option>
              ))}
            </select>
          </label>

          <SubmitButton
            idleLabel={mode === "bin" ? "Move all in bin" : "Move selected"}
            pendingLabel="Moving…"
            successLabel="Moved ✓"
            result={result as BlockActionResult | null}
            variant="secondary"
            disabled={mode === "selection" && selected.size === 0}
          />
        </form>
      </section>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
            <tr>
              <th className="w-10 px-4 py-3" aria-label="Select" />
              <th className="px-4 py-3 font-medium">Block ID</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Sealed</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium text-right">Cards</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
              <th className="px-4 py-3 font-medium">Last Pick</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {blocks.map((block) => {
              const idleDays = daysSince(block.lastPickAt ?? block.sealedAt ?? block.packedAt);
              const isStale = idleDays !== null && idleDays >= 90;

              return (
                <tr key={block.id} className="bg-zinc-950/30 transition hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(block.blockId)}
                      onChange={() => toggle(block.blockId)}
                      aria-label={`Select ${block.blockId}`}
                      className="rounded border-zinc-600 bg-zinc-950"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/blocks/${block.blockId}`}
                      className="font-mono text-amber-400 hover:text-amber-300"
                    >
                      {block.blockId}
                    </Link>
                    {block.label && <p className="text-xs text-zinc-500">{block.label}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-300">{block.locationLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={block.statusVariant}>
                        {BLOCK_STATUS_LABELS[block.status]}
                      </Badge>
                      {block.pickHoldAt && <Badge variant="warning">Quarantined</Badge>}
                      {block.reservedSessionDisplayId && (
                        <Link href={`/uploads/${block.reservedSessionDisplayId}`}>
                          <Badge variant="warning">
                            Reserved · {block.reservedSessionDisplayId}
                          </Badge>
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={block.sealedAtPending ? "text-amber-400/90" : "text-zinc-400"}>
                      {block.sealedAtLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {BLOCK_CHANNEL_LABELS[block.channel]}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    {block.cardCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-200">
                    {formatMoney(block.estimatedValueCents)}
                  </td>
                  <td className="px-4 py-3">
                    {block.lastPickAt ? (
                      <span className={isStale ? "text-amber-400" : "text-zinc-400"}>
                        {formatDate(block.lastPickAt)}
                        {idleDays !== null && <span className="ml-1 text-xs">({idleDays}d)</span>}
                      </span>
                    ) : (
                      <span className="text-amber-400">Never</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
