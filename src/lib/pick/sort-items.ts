import type { Block, Bin, CardLine, ExternalOrderLine, PickItem, Shelf } from "@prisma/client";
import { getPickSortKey, type BlockWithRelations } from "@/lib/blocks";

export type PickItemWithRelations = PickItem & {
  cardLine: CardLine | null;
  externalOrderLine: ExternalOrderLine | null;
  block: (Block & { bin: (Bin & { shelf: Shelf | null }) | null; cards: CardLine[] }) | null;
};

export interface PickBlockGroup {
  blockId: string;
  mtgBlockId: string;
  locationLabel: string;
  sortKey: string;
  items: PickItemWithRelations[];
}

function toBlockWithRelations(
  block: PickItemWithRelations["block"],
): BlockWithRelations | null {
  if (!block) return null;
  return {
    ...block,
    cards: block.cards ?? [],
  };
}

export function sortPickItems(items: PickItemWithRelations[]): PickItemWithRelations[] {
  return [...items].sort((a, b) => {
    const blockA = toBlockWithRelations(a.block);
    const blockB = toBlockWithRelations(b.block);
    const keyA = blockA ? getPickSortKey(blockA) : `zzz-${a.id}`;
    const keyB = blockB ? getPickSortKey(blockB) : `zzz-${b.id}`;
    if (keyA !== keyB) return keyA.localeCompare(keyB);
    const posA = a.cardLine?.position ?? 9999;
    const posB = b.cardLine?.position ?? 9999;
    if (posA !== posB) return posA - posB;
    return a.id.localeCompare(b.id);
  });
}

export function groupPickItemsByBlock(items: PickItemWithRelations[]): PickBlockGroup[] {
  const sorted = sortPickItems(items);
  const groups = new Map<string, PickBlockGroup>();

  for (const item of sorted) {
    const blockKey = item.blockId ?? `unallocated-${item.id}`;
    const mtgBlockId = item.block?.blockId ?? "—";
    const blockWithRelations = toBlockWithRelations(item.block);
    const sortKey = blockWithRelations ? getPickSortKey(blockWithRelations) : `zzz-${item.id}`;

    let locationLabel = "Unallocated";
    if (item.block?.bin) {
      const shelf = item.block.bin.shelf;
      locationLabel = shelf
        ? `${shelf.code} / ${item.block.bin.binId}`
        : item.block.bin.binId;
    }

    const existing = groups.get(blockKey);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(blockKey, {
        blockId: blockKey,
        mtgBlockId,
        locationLabel,
        sortKey,
        items: [item],
      });
    }
  }

  return [...groups.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
