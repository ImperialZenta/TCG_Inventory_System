import type { ChannelAdapter, ChannelCredentials, ListingPayload } from "@/lib/channels/types";
import { CHANNEL_CAPABILITIES } from "@/lib/channels/types";
import { createManaPoolClient, ManaPoolApiError } from "@/lib/manapool/client";

function clientFromCredentials(credentials: ChannelCredentials) {
  const email = credentials.email?.trim();
  const token = credentials.token?.trim();
  if (!email || !token) {
    throw new ManaPoolApiError("Mana Pool channel credentials are incomplete");
  }
  return createManaPoolClient({
    email,
    token,
    baseUrl: typeof credentials.baseUrl === "string" ? credentials.baseUrl : undefined,
  });
}

async function listingRequest(
  credentials: ChannelCredentials,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const email = credentials.email?.trim();
  const token = credentials.token?.trim();
  const baseUrl = (typeof credentials.baseUrl === "string" ? credentials.baseUrl : "https://manapool.com/api/v1").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-ManaPool-Email": email ?? "",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ManaPoolApiError(text || `Mana Pool API error (${res.status})`, res.status);
  }
  if (res.status === 204) return null;
  return res.json();
}

function listingBody(payload: ListingPayload): Record<string, unknown> {
  return {
    scryfall_id: payload.externalListingId ? undefined : undefined,
    name: payload.name,
    set_code: payload.setCode,
    collector_number: payload.collectorNumber,
    condition: payload.condition,
    finish: payload.finish,
    language: payload.language,
    quantity: payload.quantity,
    price_cents: payload.priceCents ?? undefined,
    image_uri: payload.imageUri ?? undefined,
  };
}

export const manapoolChannelAdapter: ChannelAdapter = {
  type: "MANAPOOL",
  capabilities: [
    CHANNEL_CAPABILITIES.PUSH_LISTING,
    CHANNEL_CAPABILITIES.UPDATE_QTY,
    CHANNEL_CAPABILITIES.UPDATE_PRICE,
    CHANNEL_CAPABILITIES.DELIST,
    CHANNEL_CAPABILITIES.INGEST_ORDERS,
  ],

  async pushListing(credentials, payload) {
    void clientFromCredentials(credentials);
    const data = (await listingRequest(credentials, "POST", "/seller/listings", listingBody(payload))) as {
      id?: string;
      listing_id?: string;
    } | null;
    const externalListingId = data?.listing_id ?? data?.id;
    if (!externalListingId) {
      throw new ManaPoolApiError("Mana Pool listing create did not return an id");
    }
    return { externalListingId: String(externalListingId) };
  },

  async updateQty(credentials, payload) {
    if (!payload.externalListingId) {
      throw new ManaPoolApiError("Cannot update quantity without external listing id");
    }
    await listingRequest(credentials, "PATCH", `/seller/listings/${payload.externalListingId}`, {
      quantity: payload.quantity,
    });
  },

  async updatePrice(credentials, payload) {
    if (!payload.externalListingId) {
      throw new ManaPoolApiError("Cannot update price without external listing id");
    }
    await listingRequest(credentials, "PATCH", `/seller/listings/${payload.externalListingId}`, {
      price_cents: payload.priceCents ?? undefined,
    });
  },

  async delist(credentials, payload) {
    if (!payload.externalListingId) {
      return;
    }
    await listingRequest(credentials, "DELETE", `/seller/listings/${payload.externalListingId}`);
  },
};
