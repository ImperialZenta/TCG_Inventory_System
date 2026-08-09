import { PrismaClient, BlockStatus, BlockTier, BlockChannel } from "@prisma/client";
import { LANGUAGES } from "./languages-data";
import { ensureDefaultOrganization, seedOwnerFromEnvIfConfigured } from "../src/lib/auth/bootstrap";

const prisma = new PrismaClient();

/** Number of blocks and bins this script creates on a fresh database. */
const SEEDED_COUNT = 3;

async function highestSeededBlockNum(prefix: string): Promise<number> {
  const blocks = await prisma.block.findMany({
    where: { blockId: { startsWith: `${prefix}-` } },
    select: { blockId: true },
  });

  let highest = 0;
  for (const { blockId } of blocks) {
    const suffix = blockId.slice(prefix.length + 1);
    if (!/^\d+$/.test(suffix)) continue;
    highest = Math.max(highest, Number(suffix));
  }

  return highest;
}

/**
 * Seed is non-destructive and re-runnable, so it must never rewind a counter.
 * Rewinding hands out IDs that already exist and every later formalize fails
 * on the unique blockId.
 */
async function raiseSequences() {
  const [blockSeq, binSeq, highestBlock, binCount] = await Promise.all([
    prisma.blockSequence.findUnique({ where: { id: "mtg" } }),
    prisma.binSequence.findUnique({ where: { id: "default" } }),
    highestSeededBlockNum("MTG"),
    prisma.bin.count(),
  ]);

  await prisma.blockSequence.update({
    where: { id: "mtg" },
    data: {
      nextNum: Math.max(blockSeq?.nextNum ?? 1, highestBlock + 1, SEEDED_COUNT + 1),
    },
  });

  await prisma.binSequence.update({
    where: { id: "default" },
    data: {
      nextNum: Math.max(binSeq?.nextNum ?? 1, binCount + 1, SEEDED_COUNT + 1),
    },
  });
}

async function main() {
  await ensureDefaultOrganization(process.env.SEED_ORG_NAME?.trim() || "Shop");
  await seedOwnerFromEnvIfConfigured();

  for (const lang of LANGUAGES) {
    await prisma.language.upsert({
      where: { scryfallCode: lang.scryfallCode },
      update: {
        manapoolCode: lang.manapoolCode,
        label: lang.label,
        localOnly: lang.localOnly,
      },
      create: lang,
    });
  }

  await prisma.blockSequence.upsert({
    where: { id: "mtg" },
    update: {},
    create: { id: "mtg", nextNum: 1, prefix: "MTG" },
  });

  await prisma.pickListSequence.upsert({
    where: { id: "pick" },
    update: {},
    create: { id: "pick", nextNum: 1, prefix: "PICK" },
  });

  await prisma.binSequence.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", nextNum: 1 },
  });

  await prisma.appSetting.upsert({
    where: { key: "default_staging_target_count" },
    update: {},
    create: { key: "default_staging_target_count", value: "50" },
  });

  const shelfA = await prisma.shelf.upsert({
    where: { code: "A" },
    update: {},
    create: { code: "A", label: "Main shelf A", sortOrder: 1 },
  });

  const shelfB = await prisma.shelf.upsert({
    where: { code: "B" },
    update: {},
    create: { code: "B", label: "Back room shelf B", sortOrder: 2 },
  });

  const binA1 = await prisma.bin.upsert({
    where: { binId: "A-B01" },
    update: {},
    create: {
      binId: "A-B01",
      shelfId: shelfA.id,
      label: "Standard bin (4 blocks)",
      sortOrder: 1,
    },
  });

  await prisma.bin.upsert({
    where: { binId: "A-B02" },
    update: {},
    create: {
      binId: "A-B02",
      shelfId: shelfA.id,
      label: "Small bin (2 blocks)",
      sortOrder: 2,
    },
  });

  const binB1 = await prisma.bin.upsert({
    where: { binId: "B-B01" },
    update: {},
    create: {
      binId: "B-B01",
      shelfId: shelfB.id,
      label: "Large bin (6 blocks)",
      sortOrder: 1,
    },
  });

  const existing0001 = await prisma.block.findUnique({ where: { blockId: "MTG-0001" } });
  if (!existing0001) {
    await prisma.block.create({
      data: {
        blockId: "MTG-0001",
        label: "Trade-in batch — July",
        status: BlockStatus.SEALED,
        tier: BlockTier.TRADE_IN,
        channel: BlockChannel.MANAPOOL,
        binId: binA1.id,
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
              scryfallId: "placeholder-bolt",
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 1,
              priceCents: 125,
            },
            {
              name: "Lightning Bolt",
              setCode: "mh3",
              collectorNumber: "123",
              scryfallId: "placeholder-bolt",
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 2,
              priceCents: 125,
            },
            {
              name: "Counterspell",
              setCode: "dmu",
              collectorNumber: "45",
              scryfallId: "placeholder-counterspell",
              condition: "LP",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 3,
              priceCents: 35,
            },
            {
              name: "Counterspell",
              setCode: "dmu",
              collectorNumber: "45",
              scryfallId: "placeholder-counterspell",
              condition: "LP",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 4,
              priceCents: 35,
            },
            {
              name: "Counterspell",
              setCode: "dmu",
              collectorNumber: "45",
              scryfallId: "placeholder-counterspell",
              condition: "LP",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 5,
              priceCents: 35,
            },
            {
              name: "Counterspell",
              setCode: "dmu",
              collectorNumber: "45",
              scryfallId: "placeholder-counterspell",
              condition: "LP",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 6,
              priceCents: 35,
            },
          ],
        },
      },
    });
  }

  const existing0002 = await prisma.block.findUnique({ where: { blockId: "MTG-0002" } });
  if (!existing0002) {
    await prisma.block.create({
      data: {
        blockId: "MTG-0002",
        label: "Bulk commons — pack openings",
        status: BlockStatus.ACTIVE,
        tier: BlockTier.BULK_COMMONS,
        channel: BlockChannel.MANAPOOL,
        binId: binB1.id,
        packedAt: new Date("2026-05-15"),
        sealedAt: new Date("2026-05-15"),
        activatedAt: new Date("2026-05-16"),
        targetCount: 500,
        cards: {
          create: [
            {
              isBulkLine: true,
              bulkDescription: "500 mixed commons from recent pack openings",
              name: "Bulk Commons",
              setCode: "mixed",
              quantity: 500,
              position: 1,
              priceCents: 1,
            },
          ],
        },
      },
    });
  }

  /** Shelf B singles for Phase 5 wave smoke (pairs with MTG-0001 on shelf A). */
  const existing0003 = await prisma.block.findUnique({ where: { blockId: "MTG-0003" } });
  if (!existing0003) {
    await prisma.block.create({
      data: {
        blockId: "MTG-0003",
        label: "Sideboard strip — shelf B",
        status: BlockStatus.ACTIVE,
        tier: BlockTier.GENERAL,
        channel: BlockChannel.MANAPOOL,
        binId: binB1.id,
        packedAt: new Date("2026-06-01"),
        sealedAt: new Date("2026-06-01"),
        activatedAt: new Date("2026-06-02"),
        targetCount: 50,
        cards: {
          create: [
            {
              name: "Path to Exile",
              setCode: "mh3",
              collectorNumber: "208",
              scryfallId: "placeholder-pte",
              condition: "NM",
              finish: "NONFOIL",
              language: "en",
              quantity: 1,
              position: 1,
              priceCents: 45,
            },
          ],
        },
      },
    });
  }

  await raiseSequences();

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
