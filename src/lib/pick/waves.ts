import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

interface BlockWithShelf {
  bin: {
    shelf: { code: string; sortOrder: number } | null;
  } | null;
}

export interface ShelfWaveGroup {
  shelfKey: string;
  sortKey: string;
  label: string;
  itemIds: string[];
}

export function shelfWaveGroupForBlock(block: BlockWithShelf | null): ShelfWaveGroup {
  if (!block?.bin?.shelf) {
    return {
      shelfKey: "unassigned",
      sortKey: "zzz-unassigned",
      label: "Unassigned",
      itemIds: [],
    };
  }

  const shelf = block.bin.shelf;
  return {
    shelfKey: shelf.code,
    sortKey: `${String(shelf.sortOrder).padStart(4, "0")}-${shelf.code}`,
    label: `Shelf ${shelf.code}`,
    itemIds: [],
  };
}

export async function assignWavesForPickList(
  pickListId: string,
  client: TransactionClient | typeof db = db,
): Promise<{ waveCount: number }> {
  const run = async (tx: TransactionClient) => {
    const items = await tx.pickItem.findMany({
      where: { pickListId },
      include: {
        block: {
          include: {
            bin: { include: { shelf: true } },
          },
        },
      },
    });

    await tx.pickItem.updateMany({
      where: { pickListId },
      data: { pickWaveId: null },
    });
    await tx.pickWave.deleteMany({ where: { pickListId } });

    const groupMap = new Map<string, ShelfWaveGroup>();

    for (const item of items) {
      const group = shelfWaveGroupForBlock(item.block);
      let entry = groupMap.get(group.shelfKey);
      if (!entry) {
        entry = { ...group, itemIds: [] };
        groupMap.set(group.shelfKey, entry);
      }
      entry.itemIds.push(item.id);
    }

    const sortedGroups = [...groupMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    let waveNumber = 0;
    for (const group of sortedGroups) {
      waveNumber += 1;
      const wave = await tx.pickWave.create({
        data: {
          pickListId,
          waveNumber,
          label: group.label,
        },
      });

      if (group.itemIds.length > 0) {
        await tx.pickItem.updateMany({
          where: { id: { in: group.itemIds } },
          data: { pickWaveId: wave.id },
        });
      }
    }

    return { waveCount: sortedGroups.length };
  };

  if ("$transaction" in client) {
    return client.$transaction(run);
  }

  return run(client);
}

export async function assignWaveForPickItem(
  pickItemId: string,
  client: TransactionClient | typeof db = db,
): Promise<void> {
  const item = await client.pickItem.findUnique({
    where: { id: pickItemId },
    include: {
      block: { include: { bin: { include: { shelf: true } } } },
    },
  });

  if (!item?.pickListId) return;

  const group = shelfWaveGroupForBlock(item.block);
  const existing = await client.pickWave.findFirst({
    where: { pickListId: item.pickListId, label: group.label },
  });

  const wave =
    existing ??
    (await client.pickWave.create({
      data: {
        pickListId: item.pickListId,
        waveNumber: await nextWaveNumber(client, item.pickListId),
        label: group.label,
      },
    }));

  await client.pickItem.update({
    where: { id: pickItemId },
    data: { pickWaveId: wave.id },
  });
}

async function nextWaveNumber(client: TransactionClient | typeof db, pickListId: string): Promise<number> {
  const max = await client.pickWave.aggregate({
    where: { pickListId },
    _max: { waveNumber: true },
  });
  return (max._max.waveNumber ?? 0) + 1;
}
