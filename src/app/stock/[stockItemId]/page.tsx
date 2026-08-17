import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, EmptyState } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth";
import {
  roleCanPerform,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
  STOCK_MOVEMENT_REASON_LABELS,
} from "@/lib/constants";
import { formatActorDisplay, resolveActorDisplayNames } from "@/lib/context/actor";
import { formatMoney } from "@/lib/money";
import { getStockItemDetail } from "@/lib/stock";
import { formatDate } from "@/lib/utils";
import { AdjustStockForm } from "../adjust-form";

export const dynamic = "force-dynamic";

interface StockDetailPageProps {
  params: Promise<{ stockItemId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function formatOptionalMoney(cents: number | null): string {
  if (cents == null) {
    return "—";
  }
  return formatMoney(cents);
}

function buildBackHref(searchParams: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value) {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `/stock?${qs}` : "/stock";
}

function formatReference(referenceType: string | null, referenceId: string | null): string {
  if (!referenceType && !referenceId) {
    return "—";
  }
  if (referenceType && referenceId) {
    return `${referenceType} · ${referenceId}`;
  }
  return referenceType ?? referenceId ?? "—";
}

export default async function StockDetailPage({ params, searchParams }: StockDetailPageProps) {
  const { stockItemId } = await params;
  const listQuery = await searchParams;
  const session = await getCurrentSession();
  const canAdjust = roleCanPerform(session?.role ?? null, PERMISSIONS.STOCK_ADJUST);

  let item: Awaited<ReturnType<typeof getStockItemDetail>> = null;
  let dbError = false;

  try {
    item = await getStockItemDetail(stockItemId);
  } catch {
    dbError = true;
  }

  if (!dbError && !item) {
    notFound();
  }

  const actorLabels =
    item != null
      ? await resolveActorDisplayNames(item.movements.map((m) => m.actor))
      : new Map();

  const backHref = buildBackHref(listQuery);

  return (
    <>
      <PageHeader
        title={item?.name ?? "Stock item"}
        description={
          item
            ? `${item.setCode.toUpperCase()} · ${FINISH_LABELS[item.finish] ?? item.finish} · ${CONDITION_LABELS[item.condition] ?? item.condition} · ${item.locationLabel}`
            : "Sorted stock detail"
        }
        action={
          <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Back to stock
          </Link>
        }
      />

      {dbError && (
        <EmptyState
          title="Database not ready"
          description="Run migrations — see README."
        />
      )}

      {item && (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">On hand</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-100">{item.onHand}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Reserved</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-300">{item.reserved}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Available</p>
              <p className="mt-1 text-2xl font-semibold text-amber-400">{item.available}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Cost</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-300">
                {formatOptionalMoney(item.costBasisCents)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Price</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-300">
                {formatOptionalMoney(item.marketPriceCents)}
              </p>
            </div>
          </div>

          {canAdjust && (
            <div className="mb-8">
              <AdjustStockForm stockItemId={item.id} currentOnHand={item.onHand} />
            </div>
          )}

          <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-medium text-zinc-200">Movement history</h2>
            </div>
            {item.movements.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-500">No movements recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">When</th>
                      <th className="px-4 py-3 font-medium text-right">Delta</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Actor</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {item.movements.map((movement) => (
                      <tr key={movement.id} className="text-zinc-200">
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                          {formatDate(movement.createdAt)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            movement.delta > 0
                              ? "text-emerald-400"
                              : movement.delta < 0
                                ? "text-red-400"
                                : "text-zinc-400"
                          }`}
                        >
                          {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {STOCK_MOVEMENT_REASON_LABELS[movement.reason] ?? movement.reason}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {formatActorDisplay(movement.actor, actorLabels)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                          {formatReference(movement.referenceType, movement.referenceId)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
