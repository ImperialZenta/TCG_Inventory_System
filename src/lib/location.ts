import { db } from "@/lib/db";

export async function getShelvesWithBins() {
  return db.shelf.findMany({
    include: {
      bins: {
        include: {
          _count: { select: { blocks: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getBinUtilization() {
  const bins = await db.bin.findMany({
    include: {
      shelf: true,
      _count: { select: { blocks: true } },
    },
  });

  const sorted = [...bins].sort((a, b) => {
    const shelfOrderA = a.shelf?.sortOrder ?? 9999;
    const shelfOrderB = b.shelf?.sortOrder ?? 9999;
    if (shelfOrderA !== shelfOrderB) return shelfOrderA - shelfOrderB;
    return a.sortOrder - b.sortOrder;
  });

  return sorted.map((bin) => ({
    ...bin,
    used: bin._count.blocks,
  }));
}
