"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { createUploadSessionAction, type UploadActionResult } from "@/app/uploads/actions";
import { Badge } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { BLOCK_CHANNEL_LABELS } from "@/lib/constants";
import type { ChannelCatalogListRow } from "@/lib/channel-catalogs";

interface EligibleBlock {
  id: string;
  blockId: string;
  label: string | null;
  channel: string;
  cardCount: number;
  listableRowCount: number;
  locationLabel: string;
}

interface CreateUploadSessionFormProps {
  blocks: EligibleBlock[];
  catalogs: ChannelCatalogListRow[];
  selectedCatalogId: string;
}

export function CreateUploadSessionForm({
  blocks,
  catalogs,
  selectedCatalogId,
}: CreateUploadSessionFormProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(createUploadSessionAction, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (internalId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(internalId)) next.delete(internalId);
      else next.add(internalId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(blocks.map((b) => b.id)));
  };

  const clearAll = () => setSelected(new Set());

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Marketplace</h2>
        <p className="mt-1 text-sm text-zinc-400">
          v1 supports Mana Pool batch CSV. Per-block export on block detail is unchanged.
        </p>
        <label className="mt-4 block max-w-xs text-sm">
          <span className="mb-1 block text-zinc-400">Channel</span>
          <select
            name="channel"
            required
            defaultValue="MANAPOOL"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="MANAPOOL">{BLOCK_CHANNEL_LABELS.MANAPOOL}</option>
            <option value="TCGPLAYER" disabled>
              {BLOCK_CHANNEL_LABELS.TCGPLAYER} (coming soon)
            </option>
            <option value="EBAY" disabled>
              {BLOCK_CHANNEL_LABELS.EBAY} (coming soon)
            </option>
          </select>
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-medium text-zinc-100">Catalog filter</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Optional — narrow eligible blocks to bins in a channel catalog. Configure catalogs on{" "}
          <Link href="/catalogs" className="text-amber-400 hover:text-amber-300">
            /catalogs
          </Link>
          .
        </p>
        <label className="mt-4 block max-w-md text-sm">
          <span className="mb-1 block text-zinc-400">Filter by catalog</span>
          <select
            value={selectedCatalogId}
            onChange={(event) => {
              const value = event.target.value;
              router.push(
                value ? `/uploads/new?catalogId=${encodeURIComponent(value)}` : "/uploads/new",
              );
            }}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">All eligible sealed blocks</option>
            {catalogs.map((catalog) => (
              <option key={catalog.id} value={catalog.id}>
                {catalog.label} ({BLOCK_CHANNEL_LABELS[catalog.channel]})
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-zinc-100">Sealed blocks</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Only sealed, unreserved, non-quarantined blocks are eligible.
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>
        </div>

        {[...selected].map((blockId) => (
          <input key={blockId} type="hidden" name="blockIds" value={blockId} />
        ))}

        {blocks.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">
            No eligible blocks. Seal blocks first, or cancel an open upload session.
          </p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="w-10 px-4 py-3" aria-label="Select" />
                  <th className="px-4 py-3 font-medium">Block</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium text-right">Cards</th>
                  <th className="px-4 py-3 font-medium text-right">Listable rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {blocks.map((block) => (
                  <tr key={block.id} className="bg-zinc-950/30">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(block.id)}
                        onChange={() => toggle(block.id)}
                        aria-label={`Select ${block.blockId}`}
                        className="rounded border-zinc-600 bg-zinc-950"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-amber-400">{block.blockId}</span>
                      {block.label && <p className="text-xs text-zinc-500">{block.label}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{block.locationLabel}</td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-200">
                      {block.cardCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {block.listableRowCount === 0 ? (
                        <Badge variant="warning">None</Badge>
                      ) : (
                        <span className="font-mono text-zinc-200">{block.listableRowCount}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SubmitButton
            idleLabel={`Create session (${selected.size} block${selected.size === 1 ? "" : "s"})`}
            pendingLabel="Creating…"
            successLabel="Created ✓"
            result={result as UploadActionResult | null}
            disabled={selected.size === 0}
          />
          <Link href="/uploads" className="text-sm text-zinc-400 hover:text-zinc-200">
            Cancel
          </Link>
        </div>
      </section>
    </form>
  );
}
