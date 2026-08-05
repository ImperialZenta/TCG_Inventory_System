"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formalizeStagingImportAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import type { StagingReviewGroup } from "@/lib/staging/review";

interface BinOption {
  id: string;
  binId: string;
  shelfCode: string;
  used: number;
}

interface FormalizeFormProps {
  importId: string;
  groups: StagingReviewGroup[];
  bins: BinOption[];
  defaultBinId: string | null;
  alreadyAssigned: boolean;
}

function formatBinLabel(bin: BinOption): string {
  return `${bin.binId} (${bin.shelfCode}) — ${bin.used} block${bin.used === 1 ? "" : "s"}`;
}

function buildInitialBinMap(
  groups: StagingReviewGroup[],
  defaultBinId: string | null,
): Record<number, string> {
  const initial: Record<number, string> = {};
  for (const group of groups) {
    initial[group.blockIndex] = defaultBinId ?? "";
  }
  return initial;
}

function allBinsAssigned(binByBlock: Record<number, string>, groups: StagingReviewGroup[]): boolean {
  return groups.every((group) => Boolean(binByBlock[group.blockIndex]?.trim()));
}

export function FormalizeForm({
  importId,
  groups,
  bins,
  defaultBinId,
  alreadyAssigned,
}: FormalizeFormProps) {
  const router = useRouter();
  const [result, formAction] = useActionState(formalizeStagingImportAction, null);
  const [binByBlock, setBinByBlock] = useState<Record<number, string>>(() =>
    buildInitialBinMap(groups, defaultBinId),
  );
  const [applyBinId, setApplyBinId] = useState(defaultBinId ?? "");
  const [customizePerBlock, setCustomizePerBlock] = useState(!defaultBinId);

  const totalCards = useMemo(
    () => groups.reduce((sum, group) => sum + group.totalQuantity, 0),
    [groups],
  );

  const binLabelById = useMemo(
    () => new Map(bins.map((bin) => [bin.id, formatBinLabel(bin)])),
    [bins],
  );

  const uniformBinId = useMemo(() => {
    if (groups.length === 0) return null;
    const first = binByBlock[groups[0].blockIndex];
    if (!first) return null;
    return groups.every((group) => binByBlock[group.blockIndex] === first) ? first : null;
  }, [binByBlock, groups]);

  const canSubmit = bins.length > 0 && allBinsAssigned(binByBlock, groups);

  useEffect(() => {
    if (result?.ok) {
      const timer = setTimeout(() => router.push("/blocks"), 1500);
      return () => clearTimeout(timer);
    }
  }, [result, router]);

  function applyToAllBlocks(binId: string) {
    setApplyBinId(binId);
    setBinByBlock((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        next[group.blockIndex] = binId;
      }
      return next;
    });
  }

  function setBlockBin(blockIndex: number, binId: string) {
    setBinByBlock((prev) => ({ ...prev, [blockIndex]: binId }));
  }

  if (alreadyAssigned) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        This import has been formalized into blocks.{" "}
        <Link href="/blocks" className="underline hover:text-emerald-100">
          View blocks
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="importId" value={importId} />

      {bins.length === 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Add at least one bin in Settings before formalizing blocks.
        </div>
      )}

      {bins.length > 0 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-lg font-medium text-zinc-100">Bin assignment</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {groups.length} block{groups.length === 1 ? "" : "s"} · {totalCards.toLocaleString()}{" "}
            card{totalCards === 1 ? "" : "s"}
            {uniformBinId && !customizePerBlock && binLabelById.get(uniformBinId) && (
              <>
                {" "}
                · all →{" "}
                <span className="font-mono text-zinc-200">
                  {binLabelById.get(uniformBinId)?.split(" — ")[0]}
                </span>
              </>
            )}
          </p>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-[14rem] flex-1 text-sm">
              <span className="mb-1 block text-zinc-400">Default bin for all blocks</span>
              <select
                value={applyBinId}
                onChange={(e) => setApplyBinId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="" disabled>
                  Select bin…
                </option>
                {bins.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {formatBinLabel(bin)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                if (applyBinId) applyToAllBlocks(applyBinId);
              }}
              disabled={!applyBinId}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply to all
            </button>
          </div>

          {!customizePerBlock && defaultBinId && uniformBinId ? (
            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-100/90">
              All {groups.length} blocks will be created in{" "}
              <span className="font-mono text-emerald-200">
                {binLabelById.get(uniformBinId)?.split(" — ")[0] ?? "the selected bin"}
              </span>
              .{" "}
              <button
                type="button"
                onClick={() => setCustomizePerBlock(true)}
                className="text-amber-400 underline hover:text-amber-300"
              >
                Customize per block
              </button>
            </div>
          ) : (
            <div className="mt-4">
              {defaultBinId && uniformBinId && (
                <button
                  type="button"
                  onClick={() => setCustomizePerBlock(false)}
                  className="mb-3 text-sm text-zinc-400 underline hover:text-zinc-300"
                >
                  Use summary view
                </button>
              )}
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Block</th>
                      <th className="px-3 py-2 font-medium">Cards</th>
                      <th className="px-3 py-2 font-medium">Bin</th>
                      <th className="px-3 py-2 font-medium">Positions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {groups.map((group) => (
                      <tr key={group.blockIndex} className="bg-zinc-950/30">
                        <td className="px-3 py-2 font-mono text-zinc-300">
                          {group.blockIndex} / {groups.length}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{group.totalQuantity}</td>
                        <td className="px-3 py-2">
                          <select
                            name={`bin_${group.blockIndex}`}
                            required
                            value={binByBlock[group.blockIndex] ?? ""}
                            onChange={(e) => setBlockBin(group.blockIndex, e.target.value)}
                            className="w-full min-w-[12rem] rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                          >
                            <option value="" disabled>
                              Select bin…
                            </option>
                            {bins.map((bin) => (
                              <option key={bin.id} value={bin.id}>
                                {formatBinLabel(bin)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <details>
                            <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300">
                              {group.lineCount} lines
                            </summary>
                            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-500">
                              {group.cards.map((card) => (
                                <li key={card.id} className="truncate">
                                  <span className="font-mono text-zinc-600">
                                    #{card.position ?? "—"}
                                  </span>{" "}
                                  {card.name}{" "}
                                  <span className="uppercase">{card.setCode}</span> ·{" "}
                                  {CONDITION_LABELS[card.condition]} ·{" "}
                                  {FINISH_LABELS[card.finish]}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!customizePerBlock &&
            groups.map((group) => (
              <input
                key={group.blockIndex}
                type="hidden"
                name={`bin_${group.blockIndex}`}
                value={binByBlock[group.blockIndex] ?? ""}
              />
            ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          idleLabel="Create blocks"
          pendingLabel="Creating…"
          successLabel="Created ✓"
          result={result}
          variant="primary"
          disabled={!canSubmit}
        />
        <Link
          href="/staging"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600"
        >
          Back to staging
        </Link>
      </div>
    </form>
  );
}
