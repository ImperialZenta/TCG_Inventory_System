import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { BLOCK_STATUS_LABELS, FINISH_LABELS, CONDITION_LABELS } from "@/lib/constants";
import {
  getCardQuantitySummary,
  searchCardLocations,
  type CardIdentity,
  type CardQuantitySummary,
  type CardSearchResult,
} from "@/lib/inventory";
import { InventorySearchForm } from "./inventory-search-form";

export const dynamic = "force-dynamic";

interface InventoryPageProps {
  searchParams: Promise<{
    name?: string;
    scryfallId?: string;
    set?: string;
    cn?: string;
  }>;
}

function buildIdentity(params: {
  name?: string;
  scryfallId?: string;
  set?: string;
  cn?: string;
}): CardIdentity | null {
  const name = params.name?.trim();
  if (!name) return null;

  return {
    name,
    scryfallId: params.scryfallId?.trim() || null,
    setCode: params.set?.trim() || null,
    collectorNumber: params.cn?.trim() || null,
  };
}

function QuantityPanel({ summary }: { summary: CardQuantitySummary }) {
  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
      <h2 className="text-lg font-medium text-zinc-100">Global quantity</h2>
      <p className="mt-1 text-sm text-zinc-400">
        {summary.name}{" "}
        <span className="text-zinc-500">
          ({summary.setCode.toUpperCase()}
          {summary.collectorNumber ? ` #${summary.collectorNumber}` : ""})
        </span>
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs text-zinc-500">On hand</p>
          <p className="text-xl font-semibold text-zinc-100">{summary.onHand}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs text-zinc-500">Available (sellable)</p>
          <p className="text-xl font-semibold text-emerald-400">{summary.available}</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs text-zinc-500">In packing (OPEN)</p>
          <p className="text-xl font-semibold text-amber-400">{summary.inPacking}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="text-xs text-zinc-500">On pick lists</p>
          <p className="text-xl font-semibold text-zinc-100">{summary.allocated}</p>
        </div>
      </div>
      {summary.byCondition.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.byCondition.map((row) => (
            <span
              key={row.condition}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
            >
              {CONDITION_LABELS[row.condition] ?? row.condition}: {row.count}
            </span>
          ))}
        </div>
      )}
      {summary.sortedOnHand > 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          Sorted stock: {summary.sortedOnHand} (chaos + sorted = {summary.onHand + summary.sortedOnHand})
        </p>
      )}
    </section>
  );
}

function ResultsTable({ result }: { result: CardSearchResult }) {
  if (result.printings.length === 0) {
    return (
      <EmptyState
        title="No copies in inventory"
        description={`No chaos-block copies match "${result.query.name}".`}
      />
    );
  }

  return (
    <div className="space-y-8">
      {result.printings.map((printing) => (
        <section key={printing.printingKey}>
          <h2 className="mb-3 text-lg font-medium text-zinc-100">
            {printing.name}{" "}
            <span className="text-base font-normal text-zinc-500">
              {printing.setCode.toUpperCase()}
              {printing.collectorNumber ? ` #${printing.collectorNumber}` : ""}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="min-w-full text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/80 text-left text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Block</th>
                  <th className="px-4 py-3 font-medium">Pos</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Finish</th>
                  <th className="px-4 py-3 font-medium">Lang</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {printing.locations.map((loc) => (
                  <tr key={loc.cardLineId} className="text-zinc-200">
                    <td className="px-4 py-3">
                      <Link
                        href={`/blocks/${loc.mtgBlockId}`}
                        className="font-mono text-amber-400 hover:text-amber-300"
                      >
                        {loc.mtgBlockId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">{loc.position}</td>
                    <td className="px-4 py-3">{CONDITION_LABELS[loc.condition] ?? loc.condition}</td>
                    <td className="px-4 py-3">{FINISH_LABELS[loc.finish] ?? loc.finish}</td>
                    <td className="px-4 py-3 uppercase">{loc.language}</td>
                    <td className="px-4 py-3">
                      <Badge variant={loc.isOpen ? "warning" : "default"}>
                        {BLOCK_STATUS_LABELS[loc.blockStatus] ?? loc.blockStatus}
                        {loc.isOpen ? " · packing" : ""}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{loc.locationLabel}</td>
                    <td className="px-4 py-3 capitalize text-zinc-500">{loc.storageMode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const params = await searchParams;
  const identity = buildIdentity(params);

  let searchResult: CardSearchResult | null = null;
  let quantitySummary: CardQuantitySummary | null = null;
  let dbError = false;

  if (identity) {
    try {
      [searchResult, quantitySummary] = await Promise.all([
        searchCardLocations(identity),
        getCardQuantitySummary(identity),
      ]);
    } catch {
      dbError = true;
    }
  }

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Search cards across all blocks. Find which block holds a specific card for counter sales or listing."
      />

      <div className="mb-8">
        <InventorySearchForm initialName={params.name ?? ""} />
      </div>

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run db:push and db:seed to search inventory."
        />
      ) : identity && searchResult ? (
        <>
          {quantitySummary && <QuantityPanel summary={quantitySummary} />}
          <ResultsTable result={searchResult} />
        </>
      ) : (
        <EmptyState
          title="Search for a card"
          description="Enter a card name above or pick a printing from Scryfall suggestions to see block locations and quantities."
        />
      )}
    </>
  );
}
