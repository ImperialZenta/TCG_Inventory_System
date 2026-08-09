import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { getManaPoolConfigFromEnv } from "@/lib/manapool/client";
import { listExternalOrders } from "@/lib/orders/queries";
import { ImportFixtureForm } from "./import-fixture-form";
import { ImportManaPoolButton } from "./import-manapool-button";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const manaPoolConfig = getManaPoolConfigFromEnv();
  let orders: Awaited<ReturnType<typeof listExternalOrders>> = [];
  let dbError = false;

  try {
    orders = await listExternalOrders();
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Orders"
        description="Import Mana Pool orders, review line items, then generate a pick list."
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations and seed — see README.
        </div>
      )}

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Import from Mana Pool API</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Pull recent sell orders when credentials are configured in Settings / env.
          </p>
          <div className="mt-4">
            <ImportManaPoolButton
              disabled={!manaPoolConfig}
              disabledReason="Set MANAPOOL_EMAIL and MANAPOOL_API_TOKEN to enable live import."
            />
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Import test fixture</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Upload JSON from{" "}
            <code className="text-zinc-300">docs/fixtures/manapool-order-staging-01.json</code> —
            card names must match formalized test blocks.
          </p>
          <div className="mt-4">
            <ImportFixtureForm />
          </div>
        </section>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Import from Mana Pool or upload a fixture JSON to create your first order."
        />
      ) : (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Mana Pool ID</th>
                <th className="px-4 py-3 font-medium">Lines</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Imported</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {orders.map((order) => (
                <tr key={order.id} className="text-zinc-200">
                  <td className="px-4 py-3">{order.reference ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                    {order.manapoolOrderId}
                  </td>
                  <td className="px-4 py-3">{order.lines.length}</td>
                  <td className="px-4 py-3">
                    <Badge variant={order.status === "PICKED" ? "success" : "default"}>
                      {ORDER_STATUS_LABELS[order.status] ?? order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {order.importedAt.toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
