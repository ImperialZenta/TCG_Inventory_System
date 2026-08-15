"use client";

import { useActionState } from "react";
import {
  assignBinToCatalogFormAction,
  createChannelCatalogFormAction,
  removeBinFromCatalogFormAction,
  renameChannelCatalogFormAction,
  type CatalogActionResult,
} from "@/app/uploads/catalog-actions";
import { SubmitButton } from "@/components/submit-button";
import { BLOCK_CHANNEL_LABELS } from "@/lib/constants";
import type { ChannelCatalogSummary } from "@/lib/channel-catalogs";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
}

interface CatalogFormsProps {
  catalogs: ChannelCatalogSummary[];
  bins: BinOption[];
}

export function CreateCatalogForm() {
  const [result, formAction] = useActionState(createChannelCatalogFormAction, null);

  return (
    <form action={formAction} className="space-y-3">
      <h3 className="text-sm font-medium text-zinc-300">New channel catalog</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          name="channel"
          required
          defaultValue="MANAPOOL"
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="MANAPOOL">{BLOCK_CHANNEL_LABELS.MANAPOOL}</option>
          <option value="TCGPLAYER">{BLOCK_CHANNEL_LABELS.TCGPLAYER}</option>
          <option value="EBAY">{BLOCK_CHANNEL_LABELS.EBAY}</option>
        </select>
        <input
          name="label"
          placeholder="Catalog label (e.g. Mana Pool — Shelf A)"
          required
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <SubmitButton idleLabel="Create catalog" result={result as CatalogActionResult | null} />
    </form>
  );
}

function RenameCatalogForm({ catalogId, currentLabel }: { catalogId: string; currentLabel: string }) {
  const [result, formAction] = useActionState(renameChannelCatalogFormAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="catalogId" value={catalogId} />
      <label className="min-w-[12rem] flex-1 text-sm">
        <span className="sr-only">Catalog label</span>
        <input
          name="label"
          defaultValue={currentLabel}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-zinc-100"
        />
      </label>
      <SubmitButton
        idleLabel="Save label"
        pendingLabel="Saving…"
        result={result as CatalogActionResult | null}
        variant="secondary"
      />
    </form>
  );
}

function AssignBinForm({ catalogId, bins }: { catalogId: string; bins: BinOption[] }) {
  const [result, formAction] = useActionState(assignBinToCatalogFormAction, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="catalogId" value={catalogId} />
      <label className="text-sm">
        <span className="mb-1 block text-zinc-500">Add bin</span>
        <select
          name="binId"
          required
          className="min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="">Select bin</option>
          {bins.map((bin) => (
            <option key={bin.id} value={bin.id}>
              {bin.shelfCode} / {bin.binId}
            </option>
          ))}
        </select>
      </label>
      <SubmitButton
        idleLabel="Assign"
        pendingLabel="Assigning…"
        result={result as CatalogActionResult | null}
        variant="secondary"
      />
    </form>
  );
}

function RemoveBinButton({ catalogId, binInternalId, binDisplayId }: {
  catalogId: string;
  binInternalId: string;
  binDisplayId: string;
}) {
  const [result, formAction] = useActionState(removeBinFromCatalogFormAction, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="catalogId" value={catalogId} />
      <input type="hidden" name="binId" value={binInternalId} />
      <SubmitButton
        idleLabel={`Remove ${binDisplayId}`}
        pendingLabel="Removing…"
        result={result as CatalogActionResult | null}
        variant="secondary"
      />
    </form>
  );
}

export function CatalogMembershipPanel({ catalogs, bins }: CatalogFormsProps) {
  if (catalogs.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No channel catalogs yet. Create one below, then assign bins for upload session filtering.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {catalogs.map((catalog) => (
        <section
          key={catalog.id}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <RenameCatalogForm catalogId={catalog.id} currentLabel={catalog.label} />
              <p className="text-sm text-zinc-400">
                {BLOCK_CHANNEL_LABELS[catalog.channel]} · {catalog.memberCount} bin
                {catalog.memberCount === 1 ? "" : "s"} · {catalog.sealedBlockCount} sealed block
                {catalog.sealedBlockCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {catalog.members.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No bins assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {catalog.members.map((member) => (
                <li
                  key={member.membershipId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                >
                  <span className="font-mono text-zinc-200">
                    {member.shelfCode ? `${member.shelfCode} / ` : ""}
                    {member.binDisplayId}
                    <span className="ml-2 text-zinc-500">
                      ({member.sealedBlockCount} sealed)
                    </span>
                  </span>
                  <RemoveBinButton
                    catalogId={catalog.id}
                    binInternalId={member.binInternalId}
                    binDisplayId={member.binDisplayId}
                  />
                </li>
              ))}
            </ul>
          )}

          <AssignBinForm catalogId={catalog.id} bins={bins} />
        </section>
      ))}
    </div>
  );
}
