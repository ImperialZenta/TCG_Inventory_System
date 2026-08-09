import type { Prisma, BlockStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { sumLineValueCents } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import type { Bin, Block, CardLine, Shelf } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export type BlockWithRelations = Block & {
  bin: (Bin & { shelf: Shelf | null }) | null;
  cards: CardLine[];
};

export async function allocateNextBlockId(client: TransactionClient | typeof db = db): Promise<string> {
  const seq = await client.blockSequence.upsert({
    where: { id: "mtg" },
    update: { nextNum: { increment: 1 } },
    create: { id: "mtg", nextNum: 2, prefix: "MTG" },
  });

  const num = seq.nextNum - 1;
  return `${seq.prefix}-${String(num).padStart(4, "0")}`;
}

export async function getNextBlockId(): Promise<string> {
  return allocateNextBlockId(db);
}

export async function suggestNextShelfCode(): Promise<string> {
  const shelves = await db.shelf.findMany({ orderBy: { code: "asc" } });
  if (shelves.length === 0) return "A";

  const last = shelves[shelves.length - 1].code;
  if (/^[A-Z]$/.test(last)) {
    return String.fromCharCode(last.charCodeAt(0) + 1);
  }
  return `S${shelves.length + 1}`;
}

export async function suggestNextBinId(shelfCode: string): Promise<string> {
  const shelf = await db.shelf.findUnique({ where: { code: shelfCode } });
  if (!shelf) return `${shelfCode}-B01`;

  const bins = await db.bin.findMany({
    where: { shelfId: shelf.id },
    orderBy: { binId: "desc" },
    take: 1,
  });

  if (bins.length === 0) return `${shelfCode}-B01`;

  const match = bins[0].binId.match(/B(\d+)$/);
  const next = match ? Number(match[1]) + 1 : 1;
  return `${shelfCode}-B${String(next).padStart(2, "0")}`;
}

export async function getBlocksWithStats() {
  const blocks = await db.block.findMany({
    include: {
      bin: { include: { shelf: true } },
      cards: true,
    },
    orderBy: { packedAt: "desc" },
  });

  return blocks.map((block) => {
    const cardCount = block.cards.reduce((sum, c) => sum + c.quantity, 0);
    const estimatedValueCents = sumLineValueCents(block.cards);

    return { ...block, cardCount, estimatedValueCents };
  });
}

export function getLocationLabel(block: BlockWithRelations): string {
  if (!block.bin) return "Unassigned";
  if (!block.bin.shelf) return `Unassigned / ${block.bin.binId}`;
  return `${block.bin.shelf.code} / ${block.bin.binId}`;
}

export function formatSealedAt(block: {
  status: BlockStatus;
  sealedAt: Date | null;
}): string {
  if (block.sealedAt) return formatDate(block.sealedAt);
  if (block.status === "OPEN") return "Not sealed yet";
  return "—";
}

export function isSealedAtPending(block: {
  status: BlockStatus;
  sealedAt: Date | null;
}): boolean {
  return block.status === "OPEN" && !block.sealedAt;
}

export type StatusBadgeVariant = "default" | "warning" | "success" | "muted";

export function getStatusBadgeVariant(status: BlockStatus): StatusBadgeVariant {
  switch (status) {
    case "OPEN":
      return "warning";
    case "ACTIVE":
      return "success";
    case "SEALED":
    case "ARCHIVED":
    case "LIQUIDATED":
      return "muted";
    default:
      return "default";
  }
}

export function getPickSortKey(block: BlockWithRelations): string {
  if (!block.bin) return `zzz-${block.blockId}`;
  if (!block.bin.shelf) {
    return `yyy-${String(block.bin.sortOrder).padStart(4, "0")}-${block.bin.binId}-${block.blockId}`;
  }
  const shelf = block.bin.shelf;
  return `${String(shelf.sortOrder).padStart(4, "0")}-${shelf.code}-${String(block.bin.sortOrder).padStart(4, "0")}-${block.bin.binId}-${block.blockId}`;
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
  const [blockCount, cardLines, shelfCount, binCount, staleBlocks] = await Promise.all([
    db.block.count({ where: { status: { notIn: ["ARCHIVED", "LIQUIDATED"] } } }),
    db.cardLine.findMany({ select: { quantity: true, priceCents: true } }),
    db.shelf.count(),
    db.bin.count(),
    getStaleBlocks(Number(process.env.STALE_BLOCK_DAYS ?? 90)),
  ]);

  const totalCards = cardLines.reduce((sum, c) => sum + c.quantity, 0);
  const totalValueCents = sumLineValueCents(cardLines);

  return {
    blockCount,
    totalCards,
    totalValueCents,
    shelfCount,
    binCount,
    staleBlockCount: staleBlocks.length,
  };
}

/** Pick from the block with the fewest remaining cards for a given identity. */
export async function findBlockForPick(
  scryfallId: string,
  condition: string,
  finish: string,
  language: string,
  channel: "MANAPOOL" = "MANAPOOL",
) {
  const blocks = await db.block.findMany({
    where: {
      channel,
      status: { in: ["SEALED", "ACTIVE"] },
      cards: {
        some: {
          scryfallId,
          condition: condition as CardLine["condition"],
          finish: finish as CardLine["finish"],
          language,
          quantity: { gt: 0 },
        },
      },
    },
    include: {
      bin: { include: { shelf: true } },
      cards: true,
    },
  });

  if (blocks.length === 0) return null;

  const ranked = blocks
    .map((block) => {
      const line = block.cards.find(
        (c) =>
          c.scryfallId === scryfallId &&
          c.condition === condition &&
          c.finish === finish &&
          c.language === language &&
          c.quantity > 0,
      );
      const totalInBlock = block.cards.reduce((s, c) => s + c.quantity, 0);
      return { block, line, totalInBlock };
    })
    .filter((r) => r.line)
    .sort((a, b) => a.totalInBlock - b.totalInBlock);

  return ranked[0] ?? null;
}
