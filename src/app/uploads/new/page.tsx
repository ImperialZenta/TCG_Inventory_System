import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";
import { listChannelCatalogs } from "@/lib/channel-catalogs";
import { listEligibleUploadBlocks } from "@/lib/upload-sessions";
import { requireUploadSessionPageAccess } from "@/lib/auth/upload-access";
import { CreateUploadSessionForm } from "./create-upload-session-form";

export const dynamic = "force-dynamic";

interface NewUploadSessionPageProps {
  searchParams: Promise<{ catalogId?: string }>;
}

export default async function NewUploadSessionPage({ searchParams }: NewUploadSessionPageProps) {
  await requireUploadSessionPageAccess();
  const { catalogId } = await searchParams;

  let blocks: Awaited<ReturnType<typeof listEligibleUploadBlocks>> = [];
  let catalogs: Awaited<ReturnType<typeof listChannelCatalogs>> = [];
  let dbError = false;

  try {
    [blocks, catalogs] = await Promise.all([
      listEligibleUploadBlocks(catalogId),
      listChannelCatalogs(),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="New upload session"
        description="Select sealed blocks to reserve while you upload the merged CSV to Mana Pool."
        action={
          <Link
            href="/uploads"
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Back to sessions
          </Link>
        }
      />

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run docker compose up --build, then apply migrations."
        />
      ) : (
        <CreateUploadSessionForm
          blocks={blocks}
          catalogs={catalogs}
          selectedCatalogId={catalogId ?? ""}
        />
      )}
    </>
  );
}
