import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  EVENT_CATEGORIES,
  formatEventTypeLabel,
  getMtgBlockIdFromPayload,
  getStagingImportIdFromPayload,
  listInventoryEvents,
  type EventCategory,
} from "@/lib/events";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface ActivityPageProps {
  searchParams: Promise<{
    category?: string;
    q?: string;
  }>;
}

function parseCategory(value: string | undefined): EventCategory {
  if (value === "blocks" || value === "staging" || value === "orders") {
    return value;
  }
  return "all";
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const query = await searchParams;
  const category = parseCategory(query.category);
  const search = query.q?.trim();

  let events: Awaited<ReturnType<typeof listInventoryEvents>> = [];
  let dbError = false;

  try {
    events = await listInventoryEvents({
      category: category === "all" ? undefined : category,
      mtgBlockId: search || undefined,
      limit: 100,
    });
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Activity"
        description="Append-only inventory event log — block operations, staging, and (future) orders and picks."
      />

      {dbError ? (
        <EmptyState
          title="Database not ready"
          description="Run db:push after pulling schema changes, then refresh."
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Category
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => {
                  const params = new URLSearchParams();
                  if (key !== "all") params.set("category", key);
                  if (search) params.set("q", search);
                  const href = params.toString() ? `/activity?${params}` : "/activity";

                  return (
                    <Link
                      key={key}
                      href={href}
                      className={`rounded-lg px-3 py-1.5 text-sm transition ${
                        category === key
                          ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40"
                          : "border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      {EVENT_CATEGORIES[key]}
                    </Link>
                  );
                })}
              </div>
            </div>

            <form className="min-w-[14rem] flex-1" action="/activity" method="get">
              {category !== "all" && (
                <input type="hidden" name="category" value={category} />
              )}
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-500">
                MTG block ID
                <input
                  name="q"
                  defaultValue={search ?? ""}
                  placeholder="MTG-0001"
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </label>
            </form>
          </div>

          {events.length === 0 ? (
            <EmptyState
              title="No events yet"
              description="Block lifecycle, seal, move, remove, and staging actions appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/80 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Summary</th>
                    <th className="px-4 py-3 font-medium">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {events.map((entry) => {
                    const mtgBlockId =
                      entry.block?.blockId ??
                      getMtgBlockIdFromPayload(entry.eventType, entry.payload);
                    const stagingImportId =
                      entry.stagingImportId ??
                      getStagingImportIdFromPayload(entry.payload);

                    return (
                      <tr key={entry.id} className="bg-zinc-950/30">
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                          {formatDate(entry.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {formatEventTypeLabel(entry.eventType)}
                        </td>
                        <td className="px-4 py-3 text-zinc-200">{entry.summary}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap gap-2">
                            {mtgBlockId && (
                              <Link
                                href={`/blocks/${mtgBlockId}`}
                                className="font-mono text-amber-400 hover:text-amber-300"
                              >
                                {mtgBlockId}
                              </Link>
                            )}
                            {stagingImportId && (
                              <Link
                                href={`/staging/${stagingImportId}`}
                                className="text-zinc-400 hover:text-zinc-200"
                              >
                                Staging
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
