import Link from "next/link";
import { PageHeader, Badge } from "@/components/page-header";
import { CONDITION_LABELS, FINISH_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";
import { getExternalOrderById } from "@/lib/orders/queries";
import { generatePickListAction } from "../actions";

export const dynamic = "force-dynamic";

interface OrderDetailPageProps {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function OrderDetailPage({ params, searchParams }: OrderDetailPageProps) {
  const { orderId } = await params;
  const query = await searchParams;
  const order = await getExternalOrderById(orderId);

  if (!order) {
    return (
      <>
        <PageHeader title="Order not found" />
        <Link href="/orders" className="text-sm text-amber-400 hover:text-amber-300">
          ← Back to orders
        </Link>
      </>
    );
  }

  const canGeneratePickList =
    !order.pickListId && order.status !== "PICKED" && order.status !== "CANCELLED";

  return (
    <>
      <PageHeader
        title={order.reference ?? order.manapoolOrderId}
        description={`Mana Pool order · ${order.lines.length} line${order.lines.length === 1 ? "" : "s"}`}
        action={
          canGeneratePickList ? (
            <form action={generatePickListAction}>
              <input type="hidden" name="orderId" value={order.id} />
              <button
                type="submit"
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
              >
                Generate pick list
              </button>
            </form>
          ) : order.pickList ? (
            <Link
              href={`/pick/${order.pickList.id}`}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Open {order.pickList.pickListId}
            </Link>
          ) : null
        }
      />

      {query.error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {query.error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
        <span className="text-zinc-500">Imported {order.importedAt.toLocaleString()}</span>
        <Link href="/orders" className="text-amber-400 hover:text-amber-300">
          ← All orders
        </Link>
      </div>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
            <tr>
              <th className="px-4 py-3 font-medium">Card</th>
              <th className="px-4 py-3 font-medium">Set</th>
              <th className="px-4 py-3 font-medium">Condition</th>
              <th className="px-4 py-3 font-medium">Finish</th>
              <th className="px-4 py-3 font-medium">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {order.lines.map((line) => (
              <tr key={line.id} className="text-zinc-200">
                <td className="px-4 py-3">{line.name}</td>
                <td className="px-4 py-3 font-mono text-xs uppercase text-zinc-400">
                  {line.setCode ?? "—"}
                </td>
                <td className="px-4 py-3">{CONDITION_LABELS[line.condition] ?? line.condition}</td>
                <td className="px-4 py-3">{FINISH_LABELS[line.finish] ?? line.finish}</td>
                <td className="px-4 py-3">{line.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
