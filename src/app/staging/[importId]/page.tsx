import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { getBinUtilization } from "@/lib/location";
import {
  buildStagingReviewGroups,
  countAvailableBlockSlots,
} from "@/lib/staging/review";
import { FormalizeForm } from "../formalize-form";
import { RecalculateBreakdownForm } from "../recalculate-form";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface StagingImportPageProps {
  params: Promise<{ importId: string }>;
}

export default async function StagingImportPage({ params }: StagingImportPageProps) {
  const { importId } = await params;

  const [stagingImport, bins] = await Promise.all([
    db.stagingImport.findUnique({
      where: { id: importId },
      include: {
        cards: { orderBy: { sourceRow: "asc" } },
      },
    }),
    getBinUtilization(),
  ]);

  if (!stagingImport) {
    notFound();
  }

  const groups = buildStagingReviewGroups(stagingImport.cards);
  const totalCards = stagingImport.cards.reduce((sum, c) => sum + c.quantity, 0);
  const availableSlots = countAvailableBlockSlots(bins);
  const alreadyAssigned = stagingImport.status === "ASSIGNED";

  let capacityWarning: string | null = null;
  if (!alreadyAssigned && groups.length > availableSlots) {
    capacityWarning = `Need ${groups.length} block slots across bins, but only ${availableSlots} available. Add bins or increase capacity in Settings, or raise the target count to produce fewer blocks.`;
  }

  const binOptions = bins.map((bin) => ({
    id: bin.id,
    binId: bin.binId,
    shelfCode: bin.shelf?.code ?? "Unassigned",
    available: bin.available,
    capacity: bin.capacity,
    used: bin.used,
  }));

  return (
    <>
      <PageHeader
        title="Review staging"
        description={stagingImport.filename}
        action={
          <Link href="/staging" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← All imports
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Status</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{stagingImport.status}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Total cards</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{totalCards}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Suggested blocks</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{groups.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500">Imported</p>
          <p className="mt-1 text-sm font-medium text-zinc-100">{formatDate(stagingImport.createdAt)}</p>
        </div>
      </div>

      {!alreadyAssigned && (
        <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Block breakdown</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Adjust target count and recalculate before assigning bins. Breakdown uses total card
            quantity, not line count.
          </p>
          <div className="mt-4">
            <RecalculateBreakdownForm
              importId={stagingImport.id}
              targetCount={stagingImport.targetCount ?? 200}
            />
          </div>
        </section>
      )}

      <FormalizeForm
        importId={stagingImport.id}
        groups={groups}
        bins={binOptions}
        capacityWarning={capacityWarning}
        alreadyAssigned={alreadyAssigned}
      />
    </>
  );
}
