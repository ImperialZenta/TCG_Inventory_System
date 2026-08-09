import Link from "next/link";
import { PageHeader, Badge } from "@/components/page-header";
import { PICK_LIST_STATUS_LABELS } from "@/lib/constants";
import { getPickListDetail } from "@/lib/pick/queries";
import { groupPickItemsByWave } from "@/lib/pick/sort-items";
import { PickBlockGroup } from "../pick-block-group";
import { PickListToolbar } from "../pick-list-toolbar";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PickDetailPageProps {
  params: Promise<{ pickListId: string }>;
}

async function getAlternatePositions(
  blockId: string,
  excludeCardLineId: string | null,
  identity: {
    scryfallId?: string | null;
    name: string;
    setCode?: string | null;
    condition: string;
    finish: string;
    language: string;
  },
) {
  const cards = await db.cardLine.findMany({
    where: {
      blockId,
      quantity: { gt: 0 },
      condition: identity.condition as "NM",
      finish: identity.finish as "NONFOIL",
      language: identity.language,
      ...(identity.scryfallId
        ? { scryfallId: identity.scryfallId }
        : { name: { equals: identity.name, mode: "insensitive" } }),
    },
    orderBy: { position: "asc" },
  });

  return cards
    .filter((c) => c.id !== excludeCardLineId)
    .map((c) => ({
      cardLineId: c.id,
      position: c.position,
      label: c.name,
    }));
}

export default async function PickDetailPage({ params }: PickDetailPageProps) {
  const { pickListId } = await params;
  const pickList = await getPickListDetail(pickListId);

  if (!pickList) {
    return (
      <>
        <PageHeader title="Pick list not found" />
        <Link href="/pick" className="text-sm text-amber-400 hover:text-amber-300">
          ← Back to pick lists
        </Link>
      </>
    );
  }

  const waveGroups = groupPickItemsByWave(pickList.items, pickList.waves);
  const pendingCount = pickList.items.filter((i) => i.status === "PENDING").length;

  const waveGroupsWithAlternates = await Promise.all(
    waveGroups.map(async (wave) => {
      const groupsWithAlternates = await Promise.all(
        wave.blockGroups.map(async (group) => {
          const firstPending = group.items.find((i) => i.status === "PENDING");
          let alternates: { cardLineId: string; position: number; label: string }[] = [];
          if (firstPending?.blockId && firstPending.externalOrderLine) {
            alternates = await getAlternatePositions(
              firstPending.blockId,
              firstPending.cardLineId,
              firstPending.externalOrderLine,
            );
          }
          return { group, alternates };
        }),
      );
      return { wave, groupsWithAlternates };
    }),
  );

  return (
    <>
      <PageHeader
        title={pickList.pickListId}
        description={`${pickList.items.length} items · ${pendingCount} pending${
          pickList.sourceLabel ? ` · ${pickList.sourceLabel}` : ""
        }`}
        action={
          <PickListToolbar
            pickListId={pickList.id}
            humanPickListId={pickList.pickListId}
            status={pickList.status}
          />
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Badge variant={pickList.status === "COMPLETED" ? "success" : "default"}>
          {PICK_LIST_STATUS_LABELS[pickList.status] ?? pickList.status}
        </Badge>
        {pickList.holdReason && (
          <span className="text-amber-300">
            Hold:{" "}
            {pickList.holdReason
              .replaceAll("POSITION_MISMATCH", "Position mismatch")
              .replaceAll("NO_STOCK", "No stock")
              .replaceAll("BLOCK_QUARANTINED", "Block quarantined")}
          </span>
        )}
        {pickList.orders.map((order) => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="text-amber-400 hover:text-amber-300"
          >
            Order {order.reference ?? order.manapoolOrderId}
          </Link>
        ))}
        <Link href="/pick" className="text-zinc-500 hover:text-zinc-300">
          ← All lists
        </Link>
      </div>

      <div className="space-y-10">
        {waveGroupsWithAlternates.map(({ wave, groupsWithAlternates }) => (
          <section key={wave.waveId ?? "unassigned"}>
            <div className="mb-4 flex flex-wrap items-baseline gap-3 border-b border-zinc-800 pb-2">
              <h2 className="text-lg font-medium text-zinc-100">
                Wave {wave.waveNumber}: {wave.label}
              </h2>
              <span className="text-sm text-zinc-500">
                {wave.pendingCount} pending / {wave.totalCount} items
              </span>
            </div>
            <div className="space-y-6">
              {groupsWithAlternates.map(({ group, alternates }) => (
                <PickBlockGroup
                  key={group.blockId}
                  blockId={group.blockId}
                  mtgBlockId={group.mtgBlockId}
                  locationLabel={group.locationLabel}
                  items={group.items.map((item) => ({
                    id: item.id,
                    status: item.status,
                    shortReason: item.shortReason,
                    blockedReason: item.blockedReason,
                    cardLine: item.cardLine
                      ? {
                          position: item.cardLine.position,
                          name: item.cardLine.name,
                          condition: item.cardLine.condition,
                          finish: item.cardLine.finish,
                        }
                      : null,
                    externalOrderLine: item.externalOrderLine
                      ? {
                          name: item.externalOrderLine.name,
                          condition: item.externalOrderLine.condition,
                          finish: item.externalOrderLine.finish,
                        }
                      : null,
                    block: item.block
                      ? {
                          pickHoldAt: item.block.pickHoldAt,
                          pickHoldReason: item.block.pickHoldReason,
                        }
                      : null,
                  }))}
                  pickListId={pickList.id}
                  alternatePositions={alternates}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
