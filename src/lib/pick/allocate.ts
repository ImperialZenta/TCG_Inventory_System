import type { BlockChannel, CardLine, Condition, Finish, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AllocationError } from "@/lib/pick/errors";

export interface OrderLineIdentity {
  scryfallId?: string | null;
  name: string;
  setCode?: string | null;
  condition: Condition;
  finish: Finish;
  language: string;
}

export interface AllocationResult {
  cardLine: CardLine;
  blockId: string;
  mtgBlockId: string;
  position: number;
}

type TransactionClient = Prisma.TransactionClient;

const PICKABLE_BLOCK_STATUSES = ["SEALED", "ACTIVE"] as const;

export async function getReservedCardLineIds(
  client: TransactionClient | typeof db = db,
): Promise<Set<string>> {
  const items = await client.pickItem.findMany({
    where: {
      status: "PENDING",
      cardLineId: { not: null },
      pickList: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    },
    select: { cardLineId: true },
  });

  return new Set(items.map((i) => i.cardLineId!).filter(Boolean));
}

function matchesIdentity(line: CardLine, identity: OrderLineIdentity): boolean {
  if (identity.scryfallId && line.scryfallId === identity.scryfallId) {
    return (
      line.condition === identity.condition &&
      line.finish === identity.finish &&
      line.language === identity.language &&
      line.quantity > 0
    );
  }

  const setMatch =
    !identity.setCode ||
    line.setCode.toLowerCase() === identity.setCode.toLowerCase();

  return (
    setMatch &&
    line.name.toLowerCase() === identity.name.toLowerCase() &&
    line.condition === identity.condition &&
    line.finish === identity.finish &&
    line.language === identity.language &&
    line.quantity > 0
  );
}

export async function allocateCardLineForOrderLine(
  identity: OrderLineIdentity,
  reserved: Set<string>,
  channel: BlockChannel = "MANAPOOL",
  client: TransactionClient | typeof db = db,
): Promise<AllocationResult | null> {
  const blocks = await client.block.findMany({
    where: {
      channel,
      status: { in: [...PICKABLE_BLOCK_STATUSES] },
      pickHoldAt: null,
      cards: {
        some: {
          quantity: { gt: 0 },
          condition: identity.condition,
          finish: identity.finish,
          language: identity.language,
          ...(identity.scryfallId
            ? { scryfallId: identity.scryfallId }
            : {
                name: { equals: identity.name, mode: "insensitive" as const },
                ...(identity.setCode
                  ? { setCode: { equals: identity.setCode, mode: "insensitive" as const } }
                  : {}),
              }),
        },
      },
    },
    include: {
      cards: { orderBy: { position: "asc" } },
    },
  });

  if (blocks.length === 0) return null;

  type Candidate = {
    block: (typeof blocks)[number];
    line: CardLine;
    totalInBlock: number;
  };

  const candidates: Candidate[] = [];

  for (const block of blocks) {
    const totalInBlock = block.cards.reduce((sum, c) => sum + c.quantity, 0);
    for (const line of block.cards) {
      if (reserved.has(line.id)) continue;
      if (!matchesIdentity(line, identity)) continue;
      candidates.push({ block, line, totalInBlock });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.totalInBlock !== b.totalInBlock) return a.totalInBlock - b.totalInBlock;
    if (a.line.position !== b.line.position) return a.line.position - b.line.position;
    return a.block.blockId.localeCompare(b.block.blockId);
  });

  const best = candidates[0]!;
  reserved.add(best.line.id);

  return {
    cardLine: best.line,
    blockId: best.block.id,
    mtgBlockId: best.block.blockId,
    position: best.line.position,
  };
}

export async function allocateOrThrow(
  identity: OrderLineIdentity,
  reserved: Set<string>,
  channel: BlockChannel = "MANAPOOL",
  client: TransactionClient | typeof db = db,
): Promise<AllocationResult> {
  const result = await allocateCardLineForOrderLine(identity, reserved, channel, client);
  if (!result) {
    throw new AllocationError(
      `No stock for ${identity.name}${identity.setCode ? ` (${identity.setCode})` : ""}`,
    );
  }
  return result;
}
