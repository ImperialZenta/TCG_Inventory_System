import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";

const importMock = vi.fn().mockResolvedValue({
  externalOrderId: "ord-1",
  manapoolOrderId: "mp-1",
  lineCount: 1,
  created: true,
});

vi.mock("@/lib/orders/import-order", () => ({
  importExternalOrder: importMock,
}));

vi.mock("@/lib/manapool/normalize-order", () => ({
  normalizeOrderFromApi: (payload: unknown) => payload,
}));

describe("manapool webhook", () => {
  beforeEach(() => {
    importMock.mockClear();
    delete process.env.MANAPOOL_WEBHOOK_SECRET;
    delete process.env.ALLOW_INSECURE_INBOUND;
  });

  it("returns 503 when secret is not configured", async () => {
    const { POST } = await import("@/app/api/webhooks/manapool/route");
    const body = JSON.stringify({
      manapoolOrderId: "mp-1",
      lines: [{ name: "Bolt", quantity: 1, condition: "NM", finish: "NONFOIL", language: "en" }],
    });

    const res = await POST(
      new Request("http://localhost/api/webhooks/manapool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );

    expect(res.status).toBe(503);
    expect(importMock).not.toHaveBeenCalled();
  });

  it("imports order when ALLOW_INSECURE_INBOUND is set without secret", async () => {
    process.env.ALLOW_INSECURE_INBOUND = "true";
    const { POST } = await import("@/app/api/webhooks/manapool/route");
    const body = JSON.stringify({
      manapoolOrderId: "mp-1",
      lines: [{ name: "Bolt", quantity: 1, condition: "NM", finish: "NONFOIL", language: "en" }],
    });

    const res = await POST(
      new Request("http://localhost/api/webhooks/manapool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    );

    expect(res.status).toBe(200);
    expect(importMock).toHaveBeenCalledOnce();
  });

  it("rejects invalid signature when secret configured", async () => {
    process.env.MANAPOOL_WEBHOOK_SECRET = "test-secret";
    const { POST } = await import("@/app/api/webhooks/manapool/route");
    const body = JSON.stringify({ manapoolOrderId: "mp-2", lines: [] });

    const res = await POST(
      new Request("http://localhost/api/webhooks/manapool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ManaPool-Signature": "bad",
        },
        body,
      }),
    );

    expect(res.status).toBe(401);
  });

  it("accepts valid signature", async () => {
    const secret = "test-secret";
    process.env.MANAPOOL_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({
      manapoolOrderId: "mp-3",
      lines: [{ name: "Bolt", quantity: 1, condition: "NM", finish: "NONFOIL", language: "en" }],
    });
    const signature = createHmac("sha256", secret).update(body).digest("hex");

    const { POST } = await import("@/app/api/webhooks/manapool/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/manapool", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ManaPool-Signature": signature,
        },
        body,
      }),
    );

    expect(res.status).toBe(200);
  });
});
