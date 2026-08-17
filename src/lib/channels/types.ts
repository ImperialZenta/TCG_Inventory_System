import type { ChannelOutboxOperation, ChannelType } from "@prisma/client";

export const CHANNEL_CAPABILITIES = {
  PUSH_LISTING: "pushListing",
  UPDATE_QTY: "updateQty",
  UPDATE_PRICE: "updatePrice",
  DELIST: "delist",
  INGEST_ORDERS: "ingestOrders",
} as const;

export type ChannelCapability = (typeof CHANNEL_CAPABILITIES)[keyof typeof CHANNEL_CAPABILITIES];

export interface ChannelCredentials {
  email?: string;
  token?: string;
  baseUrl?: string;
  [key: string]: unknown;
}

export interface ListingPayload {
  stockItemId: string;
  externalListingId?: string | null;
  quantity: number;
  priceCents?: number | null;
  name: string;
  setCode: string;
  collectorNumber: string;
  condition: string;
  finish: string;
  language: string;
  imageUri?: string | null;
}

export interface OutboxPayload {
  stockItemId: string;
  sku?: string;
  quantity?: number;
  priceCents?: number | null;
  externalListingId?: string | null;
  idempotencyKey: string;
}

export interface ChannelAdapter {
  readonly type: ChannelType;
  readonly capabilities: readonly ChannelCapability[];
  pushListing(credentials: ChannelCredentials, payload: ListingPayload): Promise<{ externalListingId: string }>;
  updateQty(credentials: ChannelCredentials, payload: ListingPayload): Promise<void>;
  updatePrice(credentials: ChannelCredentials, payload: ListingPayload): Promise<void>;
  delist(credentials: ChannelCredentials, payload: ListingPayload): Promise<void>;
}

export function operationForQty(qty: number): ChannelOutboxOperation {
  return qty <= 0 ? "DELIST" : "UPDATE_QTY";
}
