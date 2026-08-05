"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { StagingLogEntry, StagingUploadSummary } from "@/lib/staging/upload-log";

interface StagingActivityLogProps {
  entries: StagingLogEntry[];
  summary?: StagingUploadSummary | null;
  importId?: string | null;
  className?: string;
}

function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "—";
  }
}

const LEVEL_STYLES: Record<StagingLogEntry["level"], string> = {
  info: "text-zinc-400",
  warn: "text-amber-400",
  error: "text-red-400",
  success: "text-emerald-400",
};

export function StagingActivityLog({
  entries,
  summary,
  importId,
  className,
}: StagingActivityLogProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-200">Activity log</h3>
        {entries.length > 0 && (
          <span className="text-xs text-zinc-500">{entries.length} entries</span>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 font-mono text-xs">
        {entries.length === 0 ? (
          <p className="text-zinc-500">Activity will appear here when you upload a file.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex gap-2 leading-relaxed">
                <span className="shrink-0 text-zinc-600">{formatLogTime(entry.at)}</span>
                <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {summary && importId && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium text-emerald-200">Import complete</p>
          <ul className="mt-2 space-y-1 text-emerald-100/90">
            <li>
              {summary.filename}: {summary.csvRows} CSV row(s) → {summary.units} card(s)
            </li>
            <li>
              {summary.suggestedBlocks} suggested block(s) at target {summary.targetCount}
            </li>
            {summary.parseWarnings > 0 && (
              <li>{summary.parseWarnings} parse warning(s) — see log above</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-emerald-200/70">
            MTG block IDs (e.g. MTG-0003) are assigned when you formalize on the review page.
          </p>
          <Link
            href={`/staging/${importId}`}
            className="mt-3 inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            Continue to review →
          </Link>
        </div>
      )}
    </div>
  );
}
