import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { listInventoryEvents } from "@/lib/events/queries";
import { receiveStock, type StockIdentity } from "@/lib/stock";
import { createFormalizedImport } from "./helpers/fixtures";
import { createTestOwner, truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";

const NEO_BOLT: StockIdentity = {
  scryfallId: "neo-bolt-activity-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL",
  language: "en",
  condition: "NM",
};

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("B-019 activity category filters", () => {
  let binId: string;

  beforeEach(async () => {
    await truncateAuthTables();
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("listInventoryEvents filters stock, staging, and uploads categories", async () => {
    await createFormalizedImport(binId, 1);
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);

    const stagingEvents = await listInventoryEvents({ category: "staging" });
    expect(stagingEvents.length).toBeGreaterThan(0);
    expect(
      stagingEvents.every((e) => e.eventType.startsWith("staging.")),
    ).toBe(true);

    const stockEvents = await listInventoryEvents({ category: "stock" });
    expect(stockEvents).toHaveLength(1);
    expect(stockEvents[0]?.eventType).toBe(INVENTORY_EVENT_TYPES.STOCK_MOVEMENT);

    const uploadEvents = await listInventoryEvents({ category: "uploads" });
    expect(uploadEvents).toHaveLength(0);
  });

  it("activity page honors the stock category query param", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    await createFormalizedImport(binId, 1);

    const owner = await createTestOwner();
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(owner.session);

    const { default: ActivityPage } = await import("@/app/activity/page");
    const page = await ActivityPage({
      searchParams: Promise.resolve({ category: "stock" }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Stock movement");
    expect(html).toContain("Lightning Bolt");
    expect(html).not.toContain("Staging formalized");
    expect(html).toContain("ring-1 ring-amber-500/40");
    expect(html).toContain("Stock");
  });
});
