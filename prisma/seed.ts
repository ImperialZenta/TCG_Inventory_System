import { PrismaClient, BlockStatus, BlockTier } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.blockSequence.upsert({
    where: { id: "mtg" },
    update: {},
    create: { id: "mtg", nextNum: 1, prefix: "MTG" },
  });

  const locations = await Promise.all(
    [
      { code: "A-01-01", zone: "A", shelf: "01", slot: "01", label: "Shelf A, Row 1, Slot 1" },
      { code: "A-01-02", zone: "A", shelf: "01", slot: "02", label: "Shelf A, Row 1, Slot 2" },
      { code: "A-02-01", zone: "A", shelf: "02", slot: "01", label: "Shelf A, Row 2, Slot 1" },
      { code: "B-01-01", zone: "B", shelf: "01", slot: "01", label: "Shelf B, Row 1, Slot 1" },
    ].map((loc) =>
      prisma.location.upsert({
        where: { code: loc.code },
        update: {},
        create: loc,
      }),
    ),
  );

  const locA1 = locations[0];
  const locA2 = locations[1];

  const block1 = await prisma.block.upsert({
    where: { blockId: "MTG-0001" },
    update: {},
    create: {
      blockId: "MTG-0001",
      label: "Trade-in batch — July",
      status: BlockStatus.SEALED,
      tier: BlockTier.TRADE_IN,
      locationId: locA1.id,
      packedAt: new Date("2026-07-01"),
      sealedAt: new Date("2026-07-01"),
      lastPickAt: new Date("2026-07-28"),
      targetCount: 200,
      cards: {
        create: [
          {
            name: "Lightning Bolt",
            setCode: "mh3",
            collectorNumber: "123",
            condition: "NM",
            finish: "NONFOIL",
            quantity: 2,
            priceUsd: 1.25,
          },
          {
            name: "Counterspell",
            setCode: "dmu",
            collectorNumber: "45",
            condition: "LP",
            finish: "NONFOIL",
            quantity: 4,
            priceUsd: 0.35,
          },
          {
            isBulkLine: true,
            bulkDescription: "150 mixed commons, assorted sets",
            name: "Bulk Commons",
            setCode: "mixed",
            quantity: 150,
            priceUsd: 0.01,
          },
        ],
      },
    },
  });

  const block2 = await prisma.block.upsert({
    where: { blockId: "MTG-0002" },
    update: {},
    create: {
      blockId: "MTG-0002",
      label: "Bulk commons — pack openings",
      status: BlockStatus.ACTIVE,
      tier: BlockTier.BULK_COMMONS,
      locationId: locA2.id,
      packedAt: new Date("2026-05-15"),
      sealedAt: new Date("2026-05-15"),
      lastPickAt: null,
      targetCount: 500,
      cards: {
        create: [
          {
            isBulkLine: true,
            bulkDescription: "500 mixed commons from recent pack openings",
            name: "Bulk Commons",
            setCode: "mixed",
            quantity: 500,
            priceUsd: 0.005,
          },
        ],
      },
    },
  });

  await prisma.blockSequence.update({
    where: { id: "mtg" },
    data: { nextNum: 3 },
  });

  console.log("Seed complete:", { block1: block1.blockId, block2: block2.blockId });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
