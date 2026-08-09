import { describe, expect, it, vi, beforeEach } from "vitest";

const importBatchMock = vi.fn().mockResolvedValue({
  imported: 0,
  skipped: 0,
  errors: [],
});

vi.mock("@/lib/orders/import-orders-batch", () => ({
  importOrdersFromManaPool: importBatchMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    appSetting: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("cron sync-manapool-orders", () => {
  beforeEach(() => {
    importBatchMock.mockClear();
    delete process.env.CRON_SECRET;
    delete process.env.ALLOW_INSECURE_INBOUND;
  });

  it("returns 503 when CRON_SECRET is not configured", async () => {
    const { POST } = await import("@/app/api/cron/sync-manapool-orders/route");

    const res = await POST(
      new Request("http://localhost/api/cron/sync-manapool-orders", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(503);
    expect(importBatchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when bearer token does not match", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { POST } = await import("@/app/api/cron/sync-manapool-orders/route");

    const res = await POST(
      new Request("http://localhost/api/cron/sync-manapool-orders", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
    );

    expect(res.status).toBe(401);
    expect(importBatchMock).not.toHaveBeenCalled();
  });

  it("syncs when bearer token matches", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { POST } = await import("@/app/api/cron/sync-manapool-orders/route");

    const res = await POST(
      new Request("http://localhost/api/cron/sync-manapool-orders", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    );

    expect(res.status).toBe(200);
    expect(importBatchMock).toHaveBeenCalledOnce();
    expect(importBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { id: "cron:sync-orders" },
        source: "api",
      }),
    );
  });

  it("syncs when ALLOW_INSECURE_INBOUND is set without secret", async () => {
    process.env.ALLOW_INSECURE_INBOUND = "true";
    const { POST } = await import("@/app/api/cron/sync-manapool-orders/route");

    const res = await POST(
      new Request("http://localhost/api/cron/sync-manapool-orders", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(200);
    expect(importBatchMock).toHaveBeenCalledOnce();
  });
});
