import Link from "next/link";
import { Badge } from "@/components/page-header";
import { formatBlockIdListSummary } from "@/lib/staging/display";
import { formatDate } from "@/lib/utils";

export interface FormalizedStagingItem {
  id: string;
  filename: string;
  rowCount: number;
  createdAt: Date;
  blockCount: number;
  blockIds: string[];
  canUndo: boolean;
  undoHint: string;
}

interface FormalizedImportsSectionProps {
  items: FormalizedStagingItem[];
}

export function FormalizedImportsSection({ items }: FormalizedImportsSectionProps) {
  if (items.length === 0) return null;

  return (
    <details open className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <summary className="cursor-pointer text-lg font-medium text-zinc-100">
        Formalized imports ({items.length})
      </summary>
      <p className="mt-2 text-sm text-zinc-500">
        Committed to blocks — open an import to seal, undo formalize (unsealed only), or view MTG
        IDs.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const blockSummary = formatBlockIdListSummary(item.blockIds);

          return (
            <li key={item.id}>
              <Link
                href={`/staging/${item.id}`}
                className="flex flex-col gap-2 rounded-lg border border-zinc-800 px-3 py-3 text-sm transition hover:border-zinc-700 hover:bg-zinc-950/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-zinc-100">{item.filename}</span>
                    <Badge variant="success">Formalized</Badge>
                    {item.canUndo ? (
                      <Badge variant="muted">Undo available</Badge>
                    ) : (
                      <Badge variant="warning">Undo blocked</Badge>
                    )}
                  </div>
                  <p className="mt-1.5 text-zinc-400">
                    {item.rowCount} card{item.rowCount === 1 ? "" : "s"}
                    {item.blockCount > 0 && (
                      <>
                        {" "}
                        · {item.blockCount} block{item.blockCount === 1 ? "" : "s"}
                        {blockSummary && (
                          <>
                            {" "}
                            · <span className="font-mono text-zinc-500">{blockSummary}</span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                  {!item.canUndo && (
                    <p className="mt-1 text-xs text-amber-400/80">{item.undoHint}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-zinc-500">{formatDate(item.createdAt)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
