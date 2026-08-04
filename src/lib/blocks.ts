import { db } from "@/lib/db";
import type { Block, CardLine, Location } from "@prisma/client";

export type BlockWithRelations = Block & {
  location: Location | null;
  cards: CardLine[];
};

export async function getNextBlockId(): Promise<string> {
  const seq = await db.blockSequence.upsert({
    where: { id: "mtg" },
    update: { nextNum: { increment: 1 } },
    create: { id: "mtg", nextNum: 2, prefix: "MTG" },
  });

  const num = seq.nextNum - 1;
  return `${seq.prefix}-${String(num).padStart(4, "0")}`;
}

export async function getBlocksWithStats() {
  const blocks = await db.block.findMany({
    include: {
      location: true,
      cards: true,
    },
    orderBy: { packedAt: "desc" },
  });

  return blocks.map((block) => {
    const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
    const estimatedValue = block.cards.reduce(
      (sum, c) => sum + (c.priceUsd ?? 0) * c.quantity,
      0,
    );

    return { ...block, cardCount, estimatedValue };
  });
}

export async function getStaleBlocks(thresholdDays: number) {
  const blocks = await getBlocksWithStats();
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;

  return blocks.filter((block) => {
    if (block.status === "ARCHIVED" || block.status === "LIQUIDATED") return false;
    const lastActivity = block.lastPickAt ?? block.sealedAt ?? block.packedAt;
    return lastActivity.getTime() < cutoff;
  });
}

export async function getAgingBucketCounts(thresholdDays: number) {
  const blocks = await getBlocksWithStats();
  const active = blocks.filter(
    (b) => b.status !== "ARCHIVED" && b.status !== "LIQUIDATED",
  );

  const buckets = [
    { label: "0–30 days", count: 0 },
    { label: "31–60 days", count: 0 },
    { label: "61–90 days", count: 0 },
    { label: "90+ days", count: 0 },
  ];

  for (const block of active) {
    const lastActivity = block.lastPickAt ?? block.sealedAt ?? block.packedAt;
    const days = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (days <= 30) buckets[0].count++;
    else if (days <= 60) buckets[1].count++;
    else if (days <= 90) buckets[2].count++;
    else buckets[3].count++;
  }

  return { buckets, staleThreshold: thresholdDays };
}

export async function getDashboardStats() {
  const [blockCount, cardLines, locations, staleBlocks] = await Promise.all([
    db.block.count({ where: { status: { notIn: ["ARCHIVED", "LIQUIDATED"] } } }),
    db.cardLine.findMany({ select: { quantity: true, priceUsd: true } }),
    db.location.count(),
    getStaleBlocks(Number(process.env.STALE_BLOCK_DAYS ?? 90)),
  ]);

  const totalCards = cardLines.reduce((sum, c) => sum + c.quantity, 0);
  const totalValue = cardLines.reduce(
    (sum, c) => sum + (c.priceUsd ?? 0) * c.quantity,
    0,
  );

  return {
    blockCount,
    totalCards,
    totalValue,
    locationCount: locations,
    staleBlockCount: staleBlocks.length,
  };
}
