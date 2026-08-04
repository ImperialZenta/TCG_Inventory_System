import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";

export default function StagingPage() {
  return (
    <>
      <PageHeader
        title="Staging"
        description="Upload a ManaBox CSV of scanned cards, review the suggested block breakdown, then formalize blocks for the chaos system."
        action={
          <Link
            href="/settings"
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Default target count in Settings →
          </Link>
        }
      />

      <EmptyState
        title="Staging upload — Phase 2"
        description="CSV upload and block breakdown by target card count will be implemented next. For now, use Settings to configure shelves and bins, then view sample blocks on the Blocks page."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/blocks"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950"
            >
              View Blocks
            </Link>
            <Link
              href="/settings"
              className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200"
            >
              Configure Shelves
            </Link>
          </div>
        }
      />
    </>
  );
}
