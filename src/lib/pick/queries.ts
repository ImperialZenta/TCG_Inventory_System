import { db } from "@/lib/db";
import type { PickItemWithRelations } from "@/lib/pick/sort-items";

const pickListInclude = {
  waves: { orderBy: { waveNumber: "asc" as const } },
  items: {
    include: {
      cardLine: true,
      pickWave: true,
      block: {
        include: {
          bin: { include: { shelf: true } },
          cards: true,
        },
      },
      externalOrderLine: true,
    },
  },
  orders: true,
} as const;

export async function listActivePickLists() {
  return db.pickList.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } },
    include: {
      _count: { select: { items: true } },
      orders: { select: { id: true, reference: true, manapoolOrderId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPickListDetail(pickListId: string) {
  return db.pickList.findUnique({
    where: { id: pickListId },
    include: pickListInclude,
  });
}

export async function getPickListByHumanId(humanId: string) {
  return db.pickList.findUnique({
    where: { pickListId: humanId },
    include: pickListInclude,
  });
}

export function mapPickItems(
  pickList: NonNullable<Awaited<ReturnType<typeof getPickListDetail>>>,
): PickItemWithRelations[] {
  return pickList.items as PickItemWithRelations[];
}

export async function listCompletedPickLists(limit = 20) {
  return db.pickList.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    take: limit,
    include: {
      _count: { select: { items: true } },
      orders: { select: { reference: true, manapoolOrderId: true } },
    },
  });
}
