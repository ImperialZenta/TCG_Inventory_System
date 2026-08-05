import Link from "next/link";
import { formatDate } from "@/lib/utils";

export interface FormalizedStagingItem {
  id: string;
  filename: string;
  rowCount: number;
  createdAt: Date;
}

interface FormalizedImportsSectionProps {
  items: FormalizedStagingItem[];
}

export function FormalizedImportsSection({ items }: FormalizedImportsSectionProps) {
  if (items.length === 0) return null;

  return (
    <details className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <summary className="cursor-pointer text-lg font-medium text-zinc-100">
        Formalized imports ({items.length})
      </summary>
      <p className="mt-2 text-sm text-zinc-500">
        These imports were committed to blocks. Open to view details or go to Blocks for MTG IDs.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/staging/${item.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm transition hover:border-zinc-700 hover:bg-zinc-950/50"
            >
              <div>
                <span className="font-medium text-zinc-100">{item.filename}</span>
                <span className="ml-2 text-zinc-500">{item.rowCount} cards</span>
              </div>
              <span className="text-xs text-zinc-500">{formatDate(item.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
