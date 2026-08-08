import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { PICK_LIST_STATUS_LABELS } from "@/lib/constants";
import { listActivePickLists, listCompletedPickLists } from "@/lib/pick/queries";

export const dynamic = "force-dynamic";

export default async function PickPage() {
  let active: Awaited<ReturnType<typeof listActivePickLists>> = [];
  let completed: Awaited<ReturnType<typeof listCompletedPickLists>> = [];
  let dbError = false;

  try {
    [active, completed] = await Promise.all([listActivePickLists(), listCompletedPickLists(10)]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Pick Lists"
        description="Location-sorted picking guides for order fulfillment."
        action={
          <Link
            href="/pick/import"
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Import pullsheet
          </Link>
        }
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations — see README.
        </div>
      )}

      {active.length === 0 && completed.length === 0 ? (
        <EmptyState
          title="No pick lists yet"
          description="Generate a pick list from an imported order on the Orders page."
          action={
            <Link
              href="/orders"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              Go to Orders
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-100">Active</h2>
              <div className="space-y-2">
                {active.map((list) => (
                  <Link
                    key={list.id}
                    href={`/pick/${list.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition hover:border-zinc-700"
                  >
                    <div>
                      <span className="font-mono text-zinc-100">{list.pickListId}</span>
                      <span className="ml-3 text-sm text-zinc-500">
                        {list._count.items} items
                        {list.orders[0]?.reference
                          ? ` · ${list.orders[0].reference}`
                          : ""}
                      </span>
                    </div>
                    <Badge variant={list.status === "ON_HOLD" ? "warning" : "default"}>
                      {PICK_LIST_STATUS_LABELS[list.status] ?? list.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {completed.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-100">Recently completed</h2>
              <div className="space-y-2">
                {completed.map((list) => (
                  <Link
                    key={list.id}
                    href={`/pick/${list.id}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800/60 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-900/30"
                  >
                    <span className="font-mono">{list.pickListId}</span>
                    <span>{list.completedAt?.toLocaleDateString()}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
