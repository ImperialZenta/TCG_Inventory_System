export type {
  ChannelAdapter,
  ChannelCapability,
  ChannelCredentials,
  ListingPayload,
  OutboxPayload,
} from "@/lib/channels/types";
export { CHANNEL_CAPABILITIES, operationForQty } from "@/lib/channels/types";
export { getChannelAdapter, channelHasCapability } from "@/lib/channels/registry";
export {
  ensureDefaultManaPoolChannel,
  getChannelById,
  getChannelConfig,
  getManaPoolChannelId,
  listChannels,
  updateChannelSettings,
} from "@/lib/channels/config";
export type { ChannelConfig } from "@/lib/channels/config";
export {
  findActiveListingsForStockItem,
  findListingsForStockItem,
  getChannelListingById,
  hasActiveListingForStockItems,
  findStockItemIdsForCatalogCards,
  upsertChannelListing,
  updateListingSyncState,
} from "@/lib/channels/listings";
export {
  buildOutboxIdempotencyKey,
  enqueueOutboxInTx,
  claimPendingOutboxRows,
  markOutboxDone,
  markOutboxFailed,
} from "@/lib/channels/outbox";
export { getChannelOfferedQty, isStockItemOfferable, isCatalogCardChaosOnly, listPromotableInventory, listPromotableCardLines, listAlternateStockItems, getPromotableInventoryForStaff } from "@/lib/channels/availability";
export type { PromotableCardIdentity, PromotableCardLineOption, AlternateStockOption } from "@/lib/channels/availability";
export {
  propagateAvailabilityChange,
  enqueueListingForStockItem,
} from "@/lib/channels/oversell-guard";
export { processOutboxRow, syncListingQty, applyOutboxRowListingState, applyOutboxListingStateInTx } from "@/lib/channels/sync";
export {
  createOversellIncidentInTx,
  findConflictingReservation,
  listOversellIncidents,
  getOversellIncidentById,
  countOversellIncidents,
  getIncidentResolutionOptions,
  resolveOversellIncident,
} from "@/lib/channels/incidents";
export type { CreateOversellIncidentInput, OversellOrderRef, ResolveOversellIncidentOptions } from "@/lib/channels/incidents";
