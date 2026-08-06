import Link from "next/link";
import { Badge } from "@/components/page-header";
import {
  BLOCK_STATUS_LABELS,
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import type { ImportAssignmentSummary } from "@/lib/staging/assignment-summary";

interface AssignmentBreakdownProps {
  summary: ImportAssignmentSummary;
}

export function AssignmentBreakdown({ summary }: AssignmentBreakdownProps) {
  const hasOrphans = summary.unassignedUnits > 0;
  const totalsOk = summary.isBalanced && summary.cardLinesMatchStaging;

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-medium text-zinc-100">Assignment breakdown</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Cards linked to MTG blocks are in inventory. Unassigned cards are still on this import but
        no longer tied to a block — common after removing a single block.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <p className="text-xs text-zinc-500">In inventory</p>
          <p className="mt-1 text-sm font-medium text-emerald-300">
            {summary.inBlockUnits.toLocaleString()} card{summary.inBlockUnits === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            across {summary.blocks.length} block{summary.blocks.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Unassigned</p>
          <p
            className={`mt-1 text-sm font-medium ${hasOrphans ? "text-amber-300" : "text-zinc-100"}`}
          >
            {summary.unassignedUnits.toLocaleString()} card{summary.unassignedUnits === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Total on import</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">
            {summary.totalUnits.toLocaleString()} card{summary.totalUnits === 1 ? "" : "s"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {totalsOk ? (
              <span className="text-emerald-400/90">Totals match inventory</span>
            ) : (
              <span className="text-red-400/90">Count mismatch — refresh or contact support</span>
            )}
          </p>
        </div>
      </div>

      {hasOrphans && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">
            {summary.unassignedUnits} unassigned card{summary.unassignedUnits === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-amber-100/80">
            These cards are no longer linked to a block — often after removing one block from a
            multi-block import. If the whole scan was wrong, use{" "}
            <strong className="text-amber-100">Undo formalize</strong> below and re-upload. For one
            bad brick, partial repair workflows are planned (**I-021**); until then, remove
            remaining blocks or undo the full import as needed.
          </p>
        </div>
      )}

      {summary.blocks.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">MTG block</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">In inventory</th>
                <th className="px-3 py-2 font-medium">Card lines</th>
                <th className="px-3 py-2 font-medium">Pack block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {summary.blocks.map((block) => {
                const statusLabel = BLOCK_STATUS_LABELS[block.status] ?? block.status;
                const rowMismatch = block.stagingCount !== block.cardLineCount;

                return (
                  <tr key={block.internalId} className="bg-zinc-950/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/blocks/${block.blockId}`}
                        className="font-mono text-amber-400 hover:text-amber-300"
                      >
                        {block.blockId}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={block.status === "OPEN" ? "muted" : "success"}>
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{block.stagingCount}</td>
                    <td className={`px-3 py-2 ${rowMismatch ? "text-red-400" : "text-zinc-400"}`}>
                      {block.cardLineCount}
                      {rowMismatch && (
                        <span className="ml-1 text-xs text-red-400/80">≠ staging</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-zinc-500">
                      {block.suggestedBlock ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {summary.unassignedGroups.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-200">Unassigned by suggested block</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Original pack breakdown — these cards are not in any MTG block.
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-amber-500/20">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Suggested block</th>
                  <th className="px-3 py-2 font-medium">Cards</th>
                  <th className="px-3 py-2 font-medium">Lines</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {summary.unassignedGroups.map((group) => (
                  <tr key={group.suggestedBlock} className="bg-zinc-950/30">
                    <td className="px-3 py-2 font-mono text-zinc-300">{group.suggestedBlock}</td>
                    <td className="px-3 py-2 text-amber-300">{group.unitCount}</td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-xs text-amber-400 hover:text-amber-300">
                          {group.cards.length} lines
                        </summary>
                        <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-500">
                          {group.cards.map((card) => (
                            <li key={card.id} className="truncate">
                              <span className="font-mono text-zinc-600">
                                #{card.position ?? "—"}
                              </span>{" "}
                              {card.name}{" "}
                              <span className="uppercase">{card.setCode}</span> ·{" "}
                              {CONDITION_LABELS[card.condition]} · {FINISH_LABELS[card.finish]}
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
    </section>
  );
}
