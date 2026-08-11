import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";
import { requireCatalogConfigureAccess } from "@/lib/auth/catalog-access";
import { listCatalogSummaries } from "@/lib/channel-catalogs";
import { getBinUtilization } from "@/lib/location";
import { CatalogMembershipPanel, CreateCatalogForm } from "./catalog-forms";

export const dynamic = "force-dynamic";

export default async function CatalogsPage() {
  await requireCatalogConfigureAccess();

  let catalogs: Awaited<ReturnType<typeof listCatalogSummaries>> = [];
  let bins: Array<{ id: string; binId: string; shelfCode: string }> = [];
  let dbError = false;

  try {
    const [catalogRows, binRows] = await Promise.all([
      listCatalogSummaries(),
      getBinUtilization(),
    ]);
    catalogs = catalogRows;
    bins = binRows.map((bin) => ({
      id: bin.id,
      binId: bin.binId,
      shelfCode: bin.shelf?.code ?? "Unassigned",
    }));
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Channel catalogs"
        description="Group bins by marketplace to filter sealed blocks when creating upload sessions."
        action={
          <Link
            href="/uploads/new"
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            New upload session
          </Link>
        }
      />

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run docker compose up --build, then apply migrations."
        />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 text-lg font-medium text-zinc-100">Catalog membership</h2>
            <CatalogMembershipPanel catalogs={catalogs} bins={bins} />
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <CreateCatalogForm />
          </section>
        </div>
      )}
    </>
  );
}
