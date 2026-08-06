import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  assertBlockHasNoPickItems,
  isForeignKeyViolation,
  PickGuardError,
} from "@/lib/blocks/pick-guard";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  seedPickItemForBlock,
} from "./helpers/fixtures";

describe("pick-guard helpers (B-010)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("assertBlockHasNoPickItems passes when no picks exist", async () => {
    const fixture = await createFormalizedImport(binId, 1);

    await db.$transaction(async (tx) => {
      await expect(
        assertBlockHasNoPickItems(tx, fixture.internalIds[0]!),
      ).resolves.toBeUndefined();
    });
  });

  it("assertBlockHasNoPickItems throws PickGuardError when picks exist", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await seedPickItemForBlock(fixture.blockIds[0]!);

    await expect(
      db.$transaction(async (tx) => {
        await assertBlockHasNoPickItems(tx, fixture.internalIds[0]!);
      }),
    ).rejects.toBeInstanceOf(PickGuardError);
  });

  it("isForeignKeyViolation detects Prisma P2003", () => {
    expect(isForeignKeyViolation({ code: "P2003" })).toBe(true);
    expect(isForeignKeyViolation({ code: "P2002" })).toBe(false);
    expect(isForeignKeyViolation(new Error("nope"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});
