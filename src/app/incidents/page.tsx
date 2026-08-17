import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import { countOversellIncidents, listOversellIncidents } from "@/lib/channels/incidents";

export const dynamic = "force-dynamic";

export default async function IncidentsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let incidents: Awaited<ReturnType<typeof listOversellIncidents>> = [];
  let recentCount = 0;
  let dbError = false;

  try {
    [incidents, recentCount] = await Promise.all([
      listOversellIncidents({ limit: 50 }),
      countOversellIncidents(thirtyDaysAgo, now),
    ]);
  } catch {
    dbError = true;
  }

  return (
    <>
      <PageHeader
        title="Oversell incidents"
        description={`${recentCount} incident${recentCount === 1 ? "" : "s"} in the last 30 days.`}
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations — see README.
        </div>
      )}

      {incidents.length === 0 ? (
        <EmptyState
          title="No oversell incidents"
          description="When two channels sell the same last copy, incidents appear here for resolution."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950/50 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Stock item</th>
                <th className="px-4 py-3 font-medium">Orders</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {incidents.map((incident) => (
                <tr key={incident.id} className="text-zinc-200">
                  <td className="px-4 py-3">
                    {incident.stockItem.name}
                    <span className="ml-2 text-xs text-zinc-500">({incident.stockItem.setCode})</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {incident.orders.map((o) => o.channelOrderRef).join(" · ")}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={incident.status === "OPEN" ? "warning" : "success"}>
                      {incident.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {incident.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/incidents/${incident.id}`}
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
