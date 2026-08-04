import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { StagingUploadForm } from "./upload-form";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StagingPage() {
  let imports: Awaited<ReturnType<typeof db.stagingImport.findMany>> = [];
  let dbError = false;

  try {
    imports = await db.stagingImport.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch {
    dbError = true;
  }

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

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Upload CSV</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Export your collection from ManaBox (include Scryfall ID column). Cards are split into
            suggested blocks using your Settings target count.
          </p>
          <div className="mt-4">
            <StagingUploadForm />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Recent imports</h2>
          <div className="mt-4 space-y-2">
            {imports.length === 0 ? (
              <p className="text-sm text-zinc-500">No imports yet.</p>
            ) : (
              imports.map((item) => (
                <Link
                  key={item.id}
                  href={`/staging/${item.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm transition hover:border-zinc-700 hover:bg-zinc-950/50"
                >
                  <div>
                    <span className="font-medium text-zinc-100">{item.filename}</span>
                    <span className="ml-2 text-zinc-500">{item.rowCount} rows</span>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>{item.status}</div>
                    <div>{formatDate(item.createdAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
