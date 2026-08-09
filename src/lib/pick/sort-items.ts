import type { Block, Bin, CardLine, ExternalOrderLine, PickItem, PickWave, Shelf } from "@prisma/client";
import { getPickSortKey, type BlockWithRelations } from "@/lib/blocks";

export type PickItemWithRelations = PickItem & {
  cardLine: CardLine | null;
  externalOrderLine: ExternalOrderLine | null;
  pickWave: PickWave | null;
  block: (Block & { bin: (Bin & { shelf: Shelf | null }) | null; cards: CardLine[] }) | null;
};

export interface PickWaveGroup {
  waveId: string | null;
  waveNumber: number;
  label: string;
  pendingCount: number;
  totalCount: number;
  blockGroups: PickBlockGroup[];
}

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

export function groupPickItemsByWave(
  items: PickItemWithRelations[],
  waves: PickWave[],
): PickWaveGroup[] {
  const sortedWaves = [...waves].sort((a, b) => a.waveNumber - b.waveNumber);
  const waveIds = new Set(sortedWaves.map((w) => w.id));

  const result: PickWaveGroup[] = sortedWaves.map((wave) => {
    const waveItems = items.filter((item) => item.pickWaveId === wave.id);
    const blockGroups = groupPickItemsByBlock(waveItems);
    return {
      waveId: wave.id,
      waveNumber: wave.waveNumber,
      label: wave.label ?? `Wave ${wave.waveNumber}`,
      pendingCount: waveItems.filter((i) => i.status === "PENDING").length,
      totalCount: waveItems.length,
      blockGroups,
    };
  });

  const unassigned = items.filter((item) => !item.pickWaveId || !waveIds.has(item.pickWaveId));
  if (unassigned.length > 0) {
    result.push({
      waveId: null,
      waveNumber: sortedWaves.length + 1,
      label: "Unassigned",
      pendingCount: unassigned.filter((i) => i.status === "PENDING").length,
      totalCount: unassigned.length,
      blockGroups: groupPickItemsByBlock(unassigned),
    });
  }

  return result;
}
