import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { importExternalOrder } from "@/lib/orders/import-order";
import { receiveStock, type StockIdentity } from "@/lib/stock";
import { createTestChannel } from "./helpers/channels";
import { createFormalizedImport } from "./helpers/fixtures";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { clearMockCookies } from "./helpers/next-headers-mock";

const NEO_BOLT: StockIdentity = {
  scryfallId: "neo-bolt-ui-0123",
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

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

async function seedOversellIncident() {
  await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
  const channelA = await createTestChannel({ name: "Mana Pool", type: "MANAPOOL" });
  const channelB = await createTestChannel({ name: "Shopify", type: "SHOPIFY" });

  await importExternalOrder(
    { manapoolOrderId: "mp-ui-first", reference: "ORDER-A", lines: [boltLine()] },
    TEST_OWNER_CONTEXT,
    { channelId: channelA.id },
  );
  await importExternalOrder(
    { manapoolOrderId: "shop-ui-second", reference: "ORDER-B", lines: [boltLine()] },
    TEST_OWNER_CONTEXT,
    { channelId: channelB.id },
  );

  const { db } = await import("@/lib/db");
  const incident = await db.oversellIncident.findFirstOrThrow({ include: { stockItem: true } });
  return incident;
}

describe("CHN-005 incidents UI", () => {
  let binId: string;

  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lists both order references on /incidents", async () => {
    await seedOversellIncident();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-incidents@test.local",
      role: "MANAGER",
    });

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: IncidentsPage } = await import("@/app/incidents/page");
    const page = await IncidentsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Lightning Bolt");
    expect(html).toContain("ORDER-A");
    expect(html).toContain("ORDER-B");
    expect(html).toContain("ORDER-A · ORDER-B");
    expect(html).toContain("in the last 30 days");
  });

  it("resolve form exposes alternate stock and chaos promote selectors", async () => {
    await createFormalizedImport(binId, 1);
    const { db } = await import("@/lib/db");
    const cardLine = await db.cardLine.findFirst();
    await db.cardLine.update({
      where: { id: cardLine!.id },
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

    const incident = await seedOversellIncident();
    await receiveStock(TEST_OWNER_CONTEXT, { ...NEO_BOLT, condition: "LP" }, 1);

    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-incident-detail@test.local",
      role: "MANAGER",
    });

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: IncidentDetailPage } = await import("@/app/incidents/[incidentId]/page");
    const page = await IncidentDetailPage({
      params: Promise.resolve({ incidentId: incident.id }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Conflicting orders");
    expect(html).toContain("ORDER-A");
    expect(html).toContain("ORDER-B");
    expect(html).toContain("Alternate stock copy");
    expect(html).toContain("Chaos block card to promote");
    expect(html).toContain('name="alternateStockItemId"');
    expect(html).toContain('name="cardLineId"');
    expect(html).toContain("avail 1");
  });
});
