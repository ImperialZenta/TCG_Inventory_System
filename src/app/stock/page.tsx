import Link from "next/link";
import type { Condition } from "@prisma/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import { getShelvesWithBins } from "@/lib/location";
import { formatMoney } from "@/lib/money";
import { countStockItems, listStockItems, type StockListFilters } from "@/lib/stock";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface StockPageProps {
  searchParams: Promise<{
    q?: string;
    game?: string;
    set?: string;
    condition?: string;
    bin?: string;
    includeZero?: string;
    page?: string;
  }>;
}

function parseCondition(value: string | undefined): Condition | undefined {
  if (value === "NM" || value === "LP" || value === "MP" || value === "HP" || value === "DMG") {
    return value;
  }
  return undefined;
}

function buildListQuery(
  params: Record<string, string | undefined>,
  overrides: Record<string, string | undefined> = {},
): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

function formatOptionalMoney(cents: number | null): string {
  if (cents == null) {
    return "—";
  }
  return formatMoney(cents);
}

export default async function StockPage({ searchParams }: StockPageProps) {
  const query = await searchParams;
  const search = query.q?.trim();
  const gameId = query.game?.trim();
  const setCode = query.set?.trim();
  const condition = parseCondition(query.condition);
  const binId = query.bin?.trim();
  const includeZeroQty = query.includeZero === "1";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const listParams = {
    q: search,
    game: gameId,
    set: setCode,
    condition: query.condition,
    bin: binId,
    includeZero: includeZeroQty ? "1" : undefined,
    page: page > 1 ? String(page) : undefined,
  };

  const filters: StockListFilters = {
    search,
    gameId,
    setCode,
    condition,
    binId,
    includeZeroQty,
    limit: PAGE_SIZE,
    offset,
  };

  let items: Awaited<ReturnType<typeof listStockItems>> = [];
  let totalCount = 0;
  let shelves: Awaited<ReturnType<typeof getShelvesWithBins>> = [];
  let dbError = false;

  try {
    [items, totalCount, shelves] = await Promise.all([
      listStockItems(filters),
      countStockItems(filters),
      getShelvesWithBins(),
    ]);
  } catch {
    dbError = true;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const binOptions = shelves.flatMap((shelf) =>
    shelf.bins.map((bin) => ({
      id: bin.id,
      label: `${shelf.code} · ${bin.binId}`,
    })),
  );

  return (
    <>
      <PageHeader
        title="Stock"
        description={
          dbError
            ? "Sorted sellable inventory"
            : `${totalCount.toLocaleString()} item${totalCount === 1 ? "" : "s"} · sorted stock`
        }
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations — see README.
        </div>
      )}

      {!dbError && (
        <>
          <form className="mb-6 flex flex-wrap items-end gap-4" action="/stock" method="get">
            {includeZeroQty && <input type="hidden" name="includeZero" value="1" />}

            <label className="block min-w-[12rem] flex-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Search name
              <input
                name="q"
                defaultValue={search ?? ""}
                placeholder="Lightning Bolt"
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Game
              <select
                name="game"
                defaultValue={gameId ?? ""}
                className="mt-2 block w-full min-w-[7rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">All games</option>
                <option value="mtg">MTG</option>
              </select>
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Set
              <input
                name="set"
                defaultValue={setCode ?? ""}
                placeholder="neo"
                className="mt-2 block w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm uppercase text-zinc-100 placeholder:normal-case placeholder:text-zinc-600"
              />
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Condition
              <select
                name="condition"
                defaultValue={condition ?? ""}
                className="mt-2 block w-full min-w-[9rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">All</option>
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Location
              <select
                name="bin"
                defaultValue={binId ?? ""}
                className="mt-2 block w-full min-w-[10rem] rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">All bins</option>
                {binOptions.map((bin) => (
                  <option key={bin.id} value={bin.id}>
                    {bin.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Filter
            </button>
          </form>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/stock${buildListQuery(listParams, {
                includeZero: includeZeroQty ? undefined : "1",
                page: undefined,
              })}`}
              className={`text-sm transition ${
                includeZeroQty
                  ? "text-amber-400 hover:text-amber-300"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {includeZeroQty ? "Hide zero quantity" : "Show zero quantity"}
            </Link>

            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                Page {page} of {totalPages}
                {page > 1 && (
                  <Link
                    href={`/stock${buildListQuery(listParams, { page: String(page - 1) })}`}
                    className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
                  >
                    Previous
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/stock${buildListQuery(listParams, { page: String(page + 1) })}`}
                    className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800"
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="No stock items"
              description={
                includeZeroQty
                  ? "No items match these filters."
                  : "No items with quantity on hand. Try showing zero quantity or receive stock first."
              }
            />
          ) : (
            <section className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/50">
              <table className="w-full min-w-[64rem] text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Set</th>
                    <th className="px-4 py-3 font-medium">Finish</th>
                    <th className="px-4 py-3 font-medium">Lang</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium text-right">On hand</th>
                    <th className="px-4 py-3 font-medium text-right">Reserved</th>
                    <th className="px-4 py-3 font-medium text-right">Available</th>
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((item) => (
                    <tr key={item.id} className="text-zinc-200">
                      <td className="px-4 py-3">
                        <Link
                          href={`/stock/${item.id}${buildListQuery(listParams)}`}
                          className="font-medium text-amber-400 hover:text-amber-300"
                        >
                          {item.name}
                        </Link>
                        {item.collectorNumber && (
                          <span className="ml-2 text-xs text-zinc-500">#{item.collectorNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 uppercase text-zinc-400">{item.setCode}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {FINISH_LABELS[item.finish] ?? item.finish}
                      </td>
                      <td className="px-4 py-3 uppercase text-zinc-400">{item.language}</td>
                      <td className="px-4 py-3 text-zinc-400">
                        {CONDITION_LABELS[item.condition] ?? item.condition}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{item.locationLabel}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.onHand}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        {item.reserved}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.available}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        {formatOptionalMoney(item.costBasisCents)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                        {formatOptionalMoney(item.marketPriceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </>
  );
}
