import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { receiveStock, type StockIdentity } from "@/lib/stock";
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

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("SKU-009 stock browser UI", () => {
  let binId: string;

  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("renders /stock with browse columns, location, and result count", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 3, {
      binId,
      marketPriceCents: 199,
      referenceType: "intake",
      referenceId: "import-ui-1",
    });

    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-stock-list@test.local",
      role: "STAFF",
    });

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staff.session);

    const { default: StockPage } = await import("@/app/stock/page");
    const page = await StockPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Stock");
    expect(html).toContain("1 item · sorted stock");
    expect(html).toContain("Lightning Bolt");
    expect(html).toContain("TEST-A · TEST-A-B01");
    expect(html).toContain("Location");
    expect(html).toContain("On hand");
    expect(html).toContain("Reserved");
    expect(html).toContain("Available");
    expect(html).toContain("$1.99");
    expect(html).toContain('href="/stock/');
    expect(html).toContain("Show zero quantity");
  });

  it("renders /stock/[stockItemId] with history reference and adjust form for staff", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2, {
      binId,
      referenceType: "intake",
      referenceId: "import-ui-detail",
    });

    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-stock-detail@test.local",
      role: "STAFF",
    });

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staff.session);

    const { default: StockDetailPage } = await import("@/app/stock/[stockItemId]/page");
    const page = await StockDetailPage({
      params: Promise.resolve({ stockItemId: received.stockItem.id }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Lightning Bolt");
    expect(html).toContain("Movement history");
    expect(html).toContain("intake · import-ui-detail");
    expect(html).toContain("Receive");
    expect(html).toContain("Adjust quantity");
    expect(html).toContain('name="targetOnHand"');
    expect(html).toContain('name="reason"');
    expect(html).toContain("Damage");
    expect(html).toContain("← Back to stock");
  });
});
