import { db } from "@/lib/db";

export async function listExternalOrders() {
  return db.externalOrder.findMany({
    include: {
      lines: true,
      pickList: { select: { id: true, pickListId: true, status: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { importedAt: "desc" },
  });
}

export async function getExternalOrderById(orderId: string) {
  return db.externalOrder.findUnique({
    where: { id: orderId },
    include: {
      lines: { orderBy: { name: "asc" } },
      pickList: true,
    },
  });
}
