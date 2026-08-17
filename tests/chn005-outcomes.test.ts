import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { importExternalOrder } from "@/lib/orders/import-order";
import { receiveStock, type StockIdentity } from "@/lib/stock";
import { updateChannelBufferAction } from "@/app/settings/channels/actions";
import { resolveIncidentAction } from "@/app/incidents/actions";
import { createTestChannel } from "./helpers/channels";
import { createFormalizedImport } from "./helpers/fixtures";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";

const NEO_BOLT: StockIdentity = {
  scryfallId: "neo-bolt-settings-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL",
  language: "en",
  condition: "NM",
};

function boltLine() {
  return {
    name: NEO_BOLT.name,
    setCode: NEO_BOLT.setCode,
    collectorNumber: NEO_BOLT.collectorNumber,
    scryfallId: NEO_BOLT.scryfallId,
    condition: NEO_BOLT.condition,
    finish: NEO_BOLT.finish,
    language: NEO_BOLT.language!,
    quantity: 1,
  };
}

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("CHN-005 channel settings UI", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("renders reserve buffer controls on /settings/channels", async () => {
    await createTestChannel({ name: "Shopify", type: "SHOPIFY", reserveBufferQty: 0 });
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-channels@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const { default: ChannelSettingsPage } = await import("@/app/settings/channels/page");
    const page = await ChannelSettingsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Reserve buffer");
    expect(html).toContain('name="reserveBufferQty"');
  });

  it("persists reserve buffer through updateChannelBufferAction", async () => {
    const channel = await createTestChannel({ name: "Shopify", type: "SHOPIFY", reserveBufferQty: 0 });
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-channels-save@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const form = new FormData();
    form.set("channelId", channel.id);
    form.set("reserveBufferQty", "1");

    const result = await updateChannelBufferAction(form);
    expect(result.ok).toBe(true);

    const updated = await db.channel.findUniqueOrThrow({ where: { id: channel.id } });
    expect(updated.reserveBufferQty).toBe(1);
  });
});

describe("CHN-005 inventory promotable UI", () => {
  let binId: string;

  beforeEach(async () => {
    await resetTestDb().then((fixture) => {
      binId = fixture.binId;
    });
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lists promotable chaos cards on /inventory", async () => {
    await createFormalizedImport(binId, 1);
    const cardLine = await db.cardLine.findFirst();
    await db.cardLine.update({
      where: { id: cardLine!.id },
      data: {
        scryfallId: "neo-bolt-promotable-ui",
        name: "Lightning Bolt",
        setCode: "neo",
        collectorNumber: "0123",
      },
    });

    const { default: InventoryPage } = await import("@/app/inventory/page");
    const page = await InventoryPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Promotable from chaos");
    expect(html).toContain("Lightning Bolt");
    expect(html).toContain("MTG-0001");
  });
});

describe("CHN-005 incident resolution actions", () => {
  let binId: string;

  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function seedIncident() {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channelA = await createTestChannel({ name: "A", type: "MANAPOOL" });
    const channelB = await createTestChannel({ name: "B", type: "SHOPIFY" });
    await importExternalOrder(
      { manapoolOrderId: "mp-action-1", reference: "ORDER-A", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelA.id },
    );
    await importExternalOrder(
      { manapoolOrderId: "shop-action-2", reference: "ORDER-B", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelB.id },
    );
    return db.oversellIncident.findFirstOrThrow();
  }

  it("resolveIncidentAction fulfils from alternate stock", async () => {
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-resolve-alt@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const incident = await seedIncident();
    const alternate = await receiveStock(TEST_OWNER_CONTEXT, { ...NEO_BOLT, condition: "LP" }, 1);

    const form = new FormData();
    form.set("incidentId", incident.id);
    form.set("resolution", "FULFILLED_ALT");
    form.set("alternateStockItemId", alternate.stockItem.id);

    const result = await resolveIncidentAction(form);
    expect(result.ok).toBe(true);
    expect((await db.oversellIncident.findUnique({ where: { id: incident.id } }))?.status).toBe(
      "RESOLVED",
    );
  });

  it("resolveIncidentAction promotes from chaos", async () => {
    await createFormalizedImport(binId, 1);
    const cardLine = await db.cardLine.findFirstOrThrow();
    await db.cardLine.update({
      where: { id: cardLine.id },
      data: {
        scryfallId: NEO_BOLT.scryfallId,
        name: NEO_BOLT.name,
        setCode: NEO_BOLT.setCode,
        collectorNumber: NEO_BOLT.collectorNumber,
        finish: NEO_BOLT.finish,
        language: NEO_BOLT.language,
        condition: NEO_BOLT.condition,
      },
    });

    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-resolve-promote@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const incident = await seedIncident();
    const form = new FormData();
    form.set("incidentId", incident.id);
    form.set("resolution", "PROMOTED");
    form.set("cardLineId", cardLine.id);

    const result = await resolveIncidentAction(form);
    expect(result.ok).toBe(true);
    expect(await db.stockMovement.count({ where: { reason: "PROMOTE" } })).toBe(1);
  });

  it("resolveIncidentAction cancels with refund", async () => {
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-resolve-cancel@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const incident = await seedIncident();
    const form = new FormData();
    form.set("incidentId", incident.id);
    form.set("resolution", "CANCELLED_REFUND");

    const result = await resolveIncidentAction(form);
    expect(result.ok).toBe(true);

    const resolved = await db.oversellIncident.findUnique({ where: { id: incident.id } });
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolution).toBe("CANCELLED_REFUND");

    const resolvedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.OVERSELL_RESOLVED },
    });
    expect(resolvedEvent).not.toBeNull();
  });
});
