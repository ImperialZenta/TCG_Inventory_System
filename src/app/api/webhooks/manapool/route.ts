import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { requireConfiguredSecret } from "@/lib/inbound-auth";
import { normalizeOrderFromApi } from "@/lib/manapool/normalize-order";
import { importExternalOrder } from "@/lib/orders/import-order";
import type { DomainContext } from "@/lib/context/domain-context";

const WEBHOOK_CONTEXT: DomainContext = {
  actor: { id: "webhook:manapool" },
  organizationId: null,
  role: null,
  source: "webhook",
};

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const auth = requireConfiguredSecret(
    process.env.MANAPOOL_WEBHOOK_SECRET,
    "Mana Pool webhook",
  );
  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.text();

  if (auth.secret) {
    const signature =
      request.headers.get("x-manapool-signature") ??
      request.headers.get("x-webhook-signature");
    if (!verifySignature(body, signature, auth.secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const orderPayload =
      payload && typeof payload === "object" && "order" in payload
        ? (payload as { order: unknown }).order
        : payload;

    const order = normalizeOrderFromApi(orderPayload);
    const result = await importExternalOrder(order, WEBHOOK_CONTEXT, {
      importSource: "webhook",
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      externalOrderId: result.externalOrderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
