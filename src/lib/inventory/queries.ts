import type { BlockStatus, Condition } from "@prisma/client";
import { db } from "@/lib/db";
import { getLocationLabel, type BlockWithRelations } from "@/lib/blocks";
import { getReservedCardLineIds } from "@/lib/pick/allocate";
import {
  buildCardLineWhere,
  cardLineMatchesIdentity,
  printingKey,
  type CardIdentity,
} from "@/lib/inventory/card-identity";

export type StorageMode = "chaos" | "sorted";

export interface CardLocationRow {
  cardLineId: string;
  blockId: string;
  mtgBlockId: string;
  position: number;
  condition: Condition;
  finish: string;
  language: string;
  quantity: number;
  blockStatus: BlockStatus;
  isOpen: boolean;
  locationLabel: string;
  storageMode: StorageMode;
}

export interface PrintingGroup {
  printingKey: string;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  scryfallId: string | null;
  locations: CardLocationRow[];
}

export interface CardSearchResult {
  query: CardIdentity;
  printings: PrintingGroup[];
  sortedStock: CardLocationRow[];
}

export interface ConditionQuantity {
  condition: Condition;
  count: number;
}

export interface CardQuantitySummary {
  printingKey: string;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  onHand: number;
  inPacking: number;
  sellableOnHand: number;
  allocated: number;
  available: number;
  byCondition: ConditionQuantity[];
  sortedOnHand: number;
}

const ACTIVE_INVENTORY_STATUSES: BlockStatus[] = ["OPEN", "SEALED", "ACTIVE", "ARCHIVED"];

function toLocationRow(
  line: {
    id: string;
    position: number;
    condition: Condition;
    finish: string;
    language: string;
    quantity: number;
  },
  block: BlockWithRelations,
): CardLocationRow {
  return {
    cardLineId: line.id,
    blockId: block.id,
    mtgBlockId: block.blockId,
    position: line.position,
    condition: line.condition,
    finish: line.finish,
    language: line.language,
    quantity: line.quantity,
    blockStatus: block.status,
    isOpen: block.status === "OPEN",
    locationLabel: getLocationLabel(block),
    storageMode: "chaos",
  };
}

export async function searchCardLocations(identity: CardIdentity): Promise<CardSearchResult> {
  const blocks = await db.block.findMany({
    where: {
      status: { in: ACTIVE_INVENTORY_STATUSES },
      cards: {
        some: {
          quantity: { gt: 0 },
          ...buildCardLineWhere(identity),
        },
      },
    },
    include: {
      bin: { include: { shelf: true } },
      cards: { orderBy: { position: "asc" } },
    },
    orderBy: { blockId: "asc" },
  });

  const printingMap = new Map<string, PrintingGroup>();

  for (const block of blocks) {
    const blockWithCards: BlockWithRelations = { ...block, cards: block.cards };
    for (const line of block.cards) {
      if (!cardLineMatchesIdentity(line, identity, { requireQuantity: true })) continue;

      const key = printingKey(line);
      let group = printingMap.get(key);
      if (!group) {
        group = {
          printingKey: key,
          name: line.name,
          setCode: line.setCode,
          collectorNumber: line.collectorNumber,
          scryfallId: line.scryfallId,
          locations: [],
        };
        printingMap.set(key, group);
      }

      group.locations.push(toLocationRow(line, blockWithCards));
    }
  }

  const printings = [...printingMap.values()].sort((a, b) => {
    const nameCmp = a.name.localeCompare(b.name);
    if (nameCmp !== 0) return nameCmp;
    return a.setCode.localeCompare(b.setCode);
  });

  return {
    query: identity,
    printings,
    sortedStock: [],
  };
}

export async function getCardQuantitySummary(identity: CardIdentity): Promise<CardQuantitySummary | null> {
  const search = await searchCardLocations(identity);
  if (search.printings.length === 0) {
    return null;
  }

  const printing =
    search.printings.length === 1
      ? search.printings[0]!
      : search.printings.find(
          (p) =>
            identity.scryfallId && p.scryfallId === identity.scryfallId,
        ) ?? search.printings[0]!;

  const reserved = await getReservedCardLineIds();
  const locations = printing.locations;

  let onHand = 0;
  let inPacking = 0;
  let sellableOnHand = 0;
  let allocated = 0;
  const conditionMap = new Map<Condition, number>();

  for (const loc of locations) {
    onHand += loc.quantity;
    const cond = conditionMap.get(loc.condition) ?? 0;
    conditionMap.set(loc.condition, cond + loc.quantity);

    if (loc.isOpen) {
      inPacking += loc.quantity;
    } else {
      sellableOnHand += loc.quantity;
      if (reserved.has(loc.cardLineId)) {
        allocated += loc.quantity;
      }
    }
  }

  const byCondition = [...conditionMap.entries()]
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => a.condition.localeCompare(b.condition));

  return {
    printingKey: printing.printingKey,
    name: printing.name,
    setCode: printing.setCode,
    collectorNumber: printing.collectorNumber,
    onHand,
    inPacking,
    sellableOnHand,
    allocated,
    available: sellableOnHand - allocated,
    byCondition,
    sortedOnHand: 0,
  };
}
