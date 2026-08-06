/**
 * Manual QA helper for B-010 / B-011 pick guards.
 *
 * Creates one PickItem on the first card line of a block (by MTG block ID).
 * Run: npx tsx scripts/seed-pick-item-for-block.ts MTG-0012
 *
 * Then verify:
 * - Block detail: remove section disabled, no confirm field
 * - Remove attempt (if forced): pick-history error, block unchanged
 *
 * Cleanup: delete PickItem rows for that block in Prisma Studio or:
 *   DELETE FROM "PickItem" WHERE "blockId" = (SELECT id FROM "Block" WHERE "blockId" = 'MTG-0012');
 */
import { db } from "../src/lib/db";

const blockId = process.argv[2]?.trim();
if (!blockId) {
  console.error("Usage: npx tsx scripts/seed-pick-item-for-block.ts MTG-0012");
  process.exit(1);
}

async function main() {
  const block = await db.block.findUnique({
    where: { blockId },
    include: { cards: { take: 1, orderBy: { position: "asc" } } },
  });

  if (!block) {
    console.error(`Block not found: ${blockId}`);
    process.exit(1);
  }

  const cardLine = block.cards[0];
  if (!cardLine) {
    console.error(`Block ${blockId} has no card lines`);
    process.exit(1);
  }

  let pickList = await db.pickList.findFirst({ where: { status: "OPEN" } });
  if (!pickList) {
    pickList = await db.pickList.create({
      data: { pickListId: `PL-${Date.now()}`, status: "OPEN" },
    });
  }

  const existing = await db.pickItem.findFirst({
    where: { blockId: block.id, cardLineId: cardLine.id },
  });

  if (existing) {
    console.log(`PickItem already exists: ${existing.id}`);
    return;
  }

  const item = await db.pickItem.create({
    data: {
      pickListId: pickList.id,
      cardLineId: cardLine.id,
      blockId: block.id,
      quantity: 1,
      status: "PENDING",
    },
  });

  console.log(`Created PickItem ${item.id} on ${blockId} (card line ${cardLine.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
