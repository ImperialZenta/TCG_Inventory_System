import "./helpers/next-headers-mock";
import { describe, expect, it, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createInitialOwner, hasAnyUser } from "@/lib/auth/bootstrap";
import { authenticate } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/sessions";
import { getBlocksWithStats } from "@/lib/blocks";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { setMockSessionCookie } from "./helpers/next-headers-mock";

describe("auth pre-auth data survival", () => {
  afterAll(async () => {
    await disconnectTestDb();
  });

  it("keeps inventory accessible and null event actors after owner bootstrap", async () => {
    const { binId } = await resetTestDb();

    const block = await db.block.create({
      data: {
        blockId: "MTG-0099",
        status: "SEALED",
        binId,
        cards: {
          create: {
            name: "Legacy Card",
            setCode: "leg",
            position: 1,
            quantity: 1,
          },
        },
      },
    });

    await db.inventoryEvent.create({
      data: {
        eventType: "legacy.test",
        summary: "Pre-auth event",
        payload: { note: "before ACC-001" },
        blockId: block.id,
        actor: null,
      },
    });

    expect(await hasAnyUser()).toBe(false);
    expect(await db.block.count()).toBe(1);

    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Owner",
      password: "password123",
    });

    expect(await hasAnyUser()).toBe(true);
    expect(await db.block.count()).toBe(1);
    expect(await db.cardLine.count()).toBe(1);

    const event = await db.inventoryEvent.findFirst({
      where: { blockId: block.id },
    });
    expect(event?.actor).toBeNull();
    expect(event?.summary).toBe("Pre-auth event");

    const signedIn = await authenticate("owner@test.local", "password123");
    expect(signedIn).not.toBeNull();

    const { token } = await createSession(signedIn!.userId);
    setMockSessionCookie(token);

    const blocks = await getBlocksWithStats();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.blockId).toBe("MTG-0099");
    expect(blocks[0]?.cards[0]?.name).toBe("Legacy Card");

    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(200);

    const payload = JSON.parse(await res.text()) as {
      blocks: { blockId: string; cards: { name: string }[] }[];
    };
    expect(payload.blocks).toHaveLength(1);
    expect(payload.blocks[0]?.blockId).toBe("MTG-0099");
    expect(payload.blocks[0]?.cards[0]?.name).toBe("Legacy Card");
  });
});
