import Link from "next/link";
import { PageHeader, Badge } from "@/components/page-header";
import { getOversellIncidentById, getIncidentResolutionOptions } from "@/lib/channels/incidents";
import { ResolveIncidentForm } from "../resolve-form";

export const dynamic = "force-dynamic";

interface IncidentDetailPageProps {
  params: Promise<{ incidentId: string }>;
}

export default async function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const { incidentId } = await params;
  const incident = await getOversellIncidentById(incidentId);

  if (!incident) {
    return (
      <>
        <PageHeader title="Incident not found" />
        <Link href="/incidents" className="text-sm text-amber-400 hover:text-amber-300">
          ← Back to incidents
        </Link>
      </>
    );
  }

  const resolutionOptions = await getIncidentResolutionOptions(incidentId);
  const alternateStockItems = resolutionOptions?.alternateStockItems ?? [];
  const promotableCardLines = resolutionOptions?.promotableCardLines ?? [];

  return (
    <>
      <PageHeader
        title={incident.stockItem.name}
        description={`Oversell incident · ${incident.stockItem.setCode} · ${incident.orders.length} order reference${incident.orders.length === 1 ? "" : "s"}`}
      />

      <Link href="/incidents" className="mb-6 inline-block text-sm text-amber-400 hover:text-amber-300">
        ← Back to incidents
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h2 className="text-lg font-medium text-zinc-100">Details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-zinc-500">Status</dt>
              <dd className="mt-1">
                <Badge variant={incident.status === "OPEN" ? "warning" : "success"}>
                  {incident.status}
                </Badge>
              </dd>
            </div>
            {incident.resolution && (
              <div>
                <dt className="text-zinc-500">Resolution</dt>
                <dd className="mt-1 text-zinc-200">{incident.resolution}</dd>
              </div>
            )}
            {incident.resolutionNote && (
              <div>
                <dt className="text-zinc-500">Note</dt>
                <dd className="mt-1 text-zinc-200">{incident.resolutionNote}</dd>
              </div>
            )}
            <div>
              <dt className="text-zinc-500">Created</dt>
              <dd className="mt-1 text-zinc-200">{incident.createdAt.toLocaleString()}</dd>
            </div>
          </dl>

          <h3 className="mt-6 text-sm font-medium text-zinc-300">Conflicting orders</h3>
          <ul className="mt-2 space-y-2 text-sm text-zinc-400">
            {incident.orders.map((order) => (
              <li key={order.id}>
                <span className="text-zinc-200">{order.channel.name}</span> · {order.channelOrderRef}
                {order.externalOrder && (
                  <>
                    {" "}
                    ·{" "}
                    <Link
                      href={`/orders/${order.externalOrder.id}`}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      View order
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>

        {incident.status === "OPEN" && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-medium text-zinc-100">Resolve</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Record how staff handled the double sale.
            </p>
            <div className="mt-4">
              <ResolveIncidentForm
                incidentId={incident.id}
                alternateStockItems={alternateStockItems}
                promotableCardLines={promotableCardLines}
              />
            </div>
          </section>
        )}
      </div>
    </>
  );
}
