import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  getBlocksWithStats,
  getLocationLabel,
  formatSealedAt,
  isSealedAtPending,
  getStatusBadgeVariant,
} from "@/lib/blocks";
import { getBinSealSummary } from "@/lib/blocks/seal";
import { getBinUtilization } from "@/lib/location";
import { getDefaultFormalizeBinId } from "@/lib/staging/defaults";
import { BlocksPageContent } from "./blocks-page-content";

export const dynamic = "force-dynamic";

interface BlocksPageProps {
  searchParams: Promise<{ removedBlock?: string; cardsRemoved?: string }>;
}

async function loadBinOptions() {
  const bins = await getBinUtilization();
  return Promise.all(
    bins.map(async (bin) => ({
      id: bin.id,
      binId: bin.binId,
      shelfCode: bin.shelf?.code ?? "Unassigned",
      used: bin.used,
      sealSummary: await getBinSealSummary(bin.id),
    })),
  );
}

export default async function BlocksPage({ searchParams }: BlocksPageProps) {
  const query = await searchParams;
  const removedBlock = query.removedBlock?.trim();
  const cardsRemoved = query.cardsRemoved ? Number.parseInt(query.cardsRemoved, 10) : 0;

  let blocks: Awaited<ReturnType<typeof getBlocksWithStats>> = [];
  let binOptions: Awaited<ReturnType<typeof loadBinOptions>> = [];
  let defaultFormalizeBinId: string | null = null;
  let dbError = false;

  try {
    [blocks, binOptions, defaultFormalizeBinId] = await Promise.all([
      getBlocksWithStats(),
      loadBinOptions(),
      getDefaultFormalizeBinId(),
    ]);
  } catch {
    dbError = true;
  }

  const blockRows = blocks.map((block) => ({
    id: block.id,
    blockId: block.blockId,
    label: block.label,
    status: block.status,
    channel: block.channel,
    cardCount: block.cardCount,
    estimatedValueCents: block.estimatedValueCents,
    lastPickAt: block.lastPickAt,
    sealedAt: block.sealedAt,
    packedAt: block.packedAt,
    pickHoldAt: block.pickHoldAt,
    locationLabel: getLocationLabel(block),
    sealedAtLabel: formatSealedAt(block),
    sealedAtPending: isSealedAtPending(block),
    statusVariant: getStatusBadgeVariant(block.status),
  }));

  return (
    <>
      <PageHeader
        title="Blocks"
        description="Chaos blocks on shelves and bins — sorted by pack date (newest first)."
        action={
          <Link
            href="/staging"
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-amber-400"
          >
            Staging
          </Link>
        }
      />

      {removedBlock && (
        <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium text-emerald-200">
            Removed {removedBlock}
            {Number.isFinite(cardsRemoved) && cardsRemoved > 0 && (
              <>
                {" "}
                ({cardsRemoved} card{cardsRemoved === 1 ? "" : "s"})
              </>
            )}
          </p>
        </div>
      )}

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run docker compose up --build, then seed: docker compose exec app npm run db:seed"
        />
      ) : (
        <BlocksPageContent
          blocks={blockRows}
          binOptions={binOptions}
          defaultFormalizeBinId={defaultFormalizeBinId}
        />
      )}
    </>
  );
}
