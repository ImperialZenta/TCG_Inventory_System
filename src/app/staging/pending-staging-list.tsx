import Link from "next/link";
import { Badge } from "@/components/page-header";
import { DeleteStagingButton } from "./delete-staging-button";
import { formatDate } from "@/lib/utils";

export interface PendingStagingItem {
  id: string;
  filename: string;
  rowCount: number;
  targetCount: number | null;
  createdAt: Date;
  suggestedBlocks: number;
}

interface PendingStagingListProps {
  items: PendingStagingItem[];
}

export function PendingStagingList({ items }: PendingStagingListProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No pending staging — upload a CSV above.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <Link
            href={`/staging/${item.id}`}
            className="min-w-0 flex-1 transition hover:opacity-90"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium text-zinc-100">{item.filename}</p>
              <Badge variant="warning">Awaiting formalize</Badge>
            </div>
            <p className="mt-1.5 text-sm text-zinc-400">
              {item.rowCount} card{item.rowCount === 1 ? "" : "s"} · {item.suggestedBlocks}{" "}
              block{item.suggestedBlocks === 1 ? "" : "s"} · target{" "}
              {item.targetCount ?? 50} · {formatDate(item.createdAt)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Not in inventory yet — review to assign bins or discard to re-upload.
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/staging/${item.id}`}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              Review
            </Link>
            <DeleteStagingButton importId={item.id} filename={item.filename} />
          </div>
        </li>
      ))}
    </ul>
  );
}
