import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { allocateNextBlockId, highestBlockNumber } from "@/lib/blocks";
import { formalizeStagingImport } from "@/lib/staging/formalize";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createMultiBlockImport } from "./helpers/fixtures";

async function rewindBlockSequence(nextNum: number) {
  await db.blockSequence.upsert({
    where: { id: "mtg" },
    update: { nextNum },
    create: { id: "mtg", nextNum, prefix: "MTG" },
  });
}

describe("block ID allocation", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("allocates sequential IDs on a clean sequence", async () => {
    expect(await allocateNextBlockId()).toBe("MTG-0001");
    expect(await allocateNextBlockId()).toBe("MTG-0002");
  });

  it("skips IDs already taken when the sequence has been rewound", async () => {
    const { importId } = await createMultiBlockImport(3);
    await formalizeStagingImport(TEST_CONTEXT, importId, {
      1: binId,
      2: binId,
      3: binId,
    });

    expect(await highestBlockNumber(db, "MTG")).toBe(3);

    // A re-seed or restore can leave the counter behind the blocks that exist.
    await rewindBlockSequence(1);

    expect(await allocateNextBlockId()).toBe("MTG-0004");

    const seq = await db.blockSequence.findUnique({ where: { id: "mtg" } });
    expect(seq?.nextNum).toBe(5);
  });

  it("formalizes successfully after the sequence has been rewound", async () => {
    const first = await createMultiBlockImport(2);
    await formalizeStagingImport(TEST_CONTEXT, first.importId, { 1: binId, 2: binId });

    await rewindBlockSequence(1);

    const second = await createMultiBlockImport(2, { filename: "second.csv" });
    const created = await formalizeStagingImport(TEST_CONTEXT, second.importId, {
      1: binId,
      2: binId,
    });

    expect(created).toEqual(["MTG-0003", "MTG-0004"]);
    expect(await db.block.count()).toBe(4);
  });
});
