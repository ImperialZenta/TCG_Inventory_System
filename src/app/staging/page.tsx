import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { getSuggestedBlockCountsByImport } from "@/lib/staging/review";
import { StagingUploadForm } from "./upload-form";
import { PendingStagingList } from "./pending-staging-list";
import { FormalizedImportsSection } from "./formalized-imports-section";

export const dynamic = "force-dynamic";

export default async function StagingPage() {
  let pendingImports: Awaited<ReturnType<typeof db.stagingImport.findMany>> = [];
  let formalizedImports: Awaited<ReturnType<typeof db.stagingImport.findMany>> = [];
  let dbError = false;

  try {
    [pendingImports, formalizedImports] = await Promise.all([
      db.stagingImport.findMany({
        where: { status: "PARSED" },
        orderBy: { createdAt: "desc" },
      }),
      db.stagingImport.findMany({
        where: { status: "ASSIGNED" },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
  } catch {
    dbError = true;
  }

  const blockCounts = await getSuggestedBlockCountsByImport(
    pendingImports.map((item) => item.id),
  );

  const pendingItems = pendingImports.map((item) => ({
    id: item.id,
    filename: item.filename,
    rowCount: item.rowCount,
    targetCount: item.targetCount,
    createdAt: item.createdAt,
    suggestedBlocks: blockCounts.get(item.id) ?? 1,
  }));

  const formalizedItems = formalizedImports.map((item) => ({
    id: item.id,
    filename: item.filename,
    rowCount: item.rowCount,
    createdAt: item.createdAt,
  }));

  return (
    <>
      <PageHeader
        title="Staging"
        description="Upload a ManaBox CSV of scanned cards, review the suggested block breakdown, then formalize blocks for the chaos system."
        action={
          <Link href="/settings" className="text-sm text-zinc-400 hover:text-zinc-200">
            Default target count in Settings →
          </Link>
        }
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations and seed — see README Docker section.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-400">
        After upload, pending imports appear below. Use <strong className="text-zinc-300">Review</strong>{" "}
        to assign bins and formalize — MTG block IDs are created when you create blocks.
      </div>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="text-lg font-medium text-zinc-100">Upload CSV</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Export a ManaBox binder CSV (include Scryfall ID). Pack order follows CSV row order;
          quantity &gt; 1 expands to consecutive positions. Blocks are hard-capped at your Settings
          target count. Pack the brick to match the CSV sheet order.
        </p>
        <div className="mt-4">
          <StagingUploadForm />
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-zinc-100">Pending staging</h2>
          {pendingItems.length > 0 && (
            <span className="text-sm text-amber-400/90">
              {pendingItems.length} awaiting formalize
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-zinc-400">
          Uncommitted imports waiting for bin assignment. Delete removes the staging data — re-upload
          the CSV to start over.
        </p>
        <div className="mt-4">
          <PendingStagingList items={pendingItems} />
        </div>
      </section>

      <FormalizedImportsSection items={formalizedItems} />
    </>
  );
}
