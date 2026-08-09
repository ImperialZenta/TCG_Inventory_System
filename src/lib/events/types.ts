import { z } from "zod";

/** Implemented v1 event types including Phase 4 order/pick events. */
export const INVENTORY_EVENT_TYPES = {
  BLOCK_SEALED: "block.sealed",
  BLOCK_LIFECYCLE: "block.lifecycle",
  BLOCK_MOVED: "block.moved",
  BLOCK_REMOVED: "block.removed",
  STAGING_FORMALIZED: "staging.formalized",
  STAGING_UNDO_FORMALIZE: "staging.undo_formalize",
  STAGING_DELETED: "staging.deleted",
  // Phase 4 — order & pick events
  ORDER_IMPORTED: "order.imported",
  PICK_LIST_CREATED: "pick.list_created",
  PICK_ITEM_ALLOCATED: "pick.item_allocated",
  PICK_ITEM_PICKED: "pick.item_picked",
  PICK_ITEM_SHORT: "pick.item_short",
  PICK_ITEM_SUBSTITUTED: "pick.item_substituted",
  PICK_COUNTER: "pick.counter_pick",
  INVENTORY_DECREMENTED: "inventory.decremented",
  BLOCK_QUARANTINED: "block.quarantined",
  BLOCK_QUARANTINE_CLEARED: "block.quarantine_cleared",
  STAGING_CORRECTION_CREATED: "staging.correction_created",
  PERMISSION_DENIED: "auth.permission_denied",
} as const;

export type InventoryEventType =
  (typeof INVENTORY_EVENT_TYPES)[keyof typeof INVENTORY_EVENT_TYPES];

export const EVENT_CATEGORIES = {
  all: "All",
  blocks: "Blocks",
  staging: "Staging",
  orders: "Orders & picks",
} as const;

export type EventCategory = keyof typeof EVENT_CATEGORIES;

const blockSealedPayload = z.object({
  mtgBlockId: z.string(),
  cardCount: z.number().int().nonnegative(),
});

const blockLifecyclePayload = z.object({
  mtgBlockId: z.string(),
  fromStatus: z.string(),
  toStatus: z.string(),
  transition: z.enum(["ACTIVATE", "ARCHIVE", "LIQUIDATE"]),
});

const blockMovedPayload = z.object({
  mtgBlockId: z.string(),
  fromBin: z.string(),
  toBin: z.string(),
});

const blockRemovedPayload = z.object({
  mtgBlockId: z.string(),
  cardCount: z.number().int().nonnegative(),
  priorStatus: z.string(),
});

const stagingFormalizedPayload = z.object({
  importId: z.string(),
  filename: z.string(),
  mtgBlockIds: z.array(z.string()),
  cardCount: z.number().int().nonnegative(),
});

const stagingUndoFormalizePayload = z.object({
  importId: z.string(),
  filename: z.string(),
  mtgBlockIds: z.array(z.string()),
  cardCount: z.number().int().nonnegative(),
  mode: z.literal("discard"),
});

const stagingDeletedPayload = z.object({
  importId: z.string(),
  filename: z.string(),
  status: z.string(),
});

const orderImportedPayload = z.object({
  externalOrderId: z.string(),
  channel: z.string(),
  lineCount: z.number().int().nonnegative(),
  reference: z.string().optional(),
  source: z.enum(["api", "fixture", "webhook", "cron"]).optional(),
});

const pickListCreatedPayload = z.object({
  pickListId: z.string(),
  itemCount: z.number().int().nonnegative(),
  orderIds: z.array(z.string()),
});

const pickItemAllocatedPayload = z.object({
  pickListId: z.string(),
  pickItemId: z.string(),
  mtgBlockId: z.string(),
  position: z.number().int().positive(),
  cardName: z.string(),
});

const pickItemPickedPayload = z.object({
  pickListId: z.string(),
  pickItemId: z.string(),
  mtgBlockId: z.string(),
  position: z.number().int().positive(),
  cardName: z.string(),
});

const pickItemShortPayload = z.object({
  pickListId: z.string(),
  pickItemId: z.string(),
  mtgBlockId: z.string().optional(),
  cardName: z.string(),
  reason: z.string(),
});

const inventoryDecrementedPayload = z.object({
  cardLineId: z.string(),
  mtgBlockId: z.string(),
  position: z.number().int().positive(),
  cardName: z.string(),
  quantity: z.number().int().positive(),
  pickItemId: z.string().optional(),
});

const pickItemSubstitutedPayload = z.object({
  pickListId: z.string(),
  pickItemId: z.string(),
  fromMtgBlockId: z.string(),
  fromPosition: z.number().int().positive(),
  toMtgBlockId: z.string(),
  toPosition: z.number().int().positive(),
  cardName: z.string(),
});

const pickCounterPayload = z.object({
  mtgBlockId: z.string(),
  position: z.number().int().positive(),
  cardName: z.string(),
});

const blockQuarantinedPayload = z.object({
  mtgBlockId: z.string(),
  reason: z.string(),
  heldPickListIds: z.array(z.string()).optional(),
});

const blockQuarantineClearedPayload = z.object({
  mtgBlockId: z.string(),
});

const stagingCorrectionCreatedPayload = z.object({
  importId: z.string(),
  filename: z.string(),
  sourcePickListId: z.string().optional(),
  sourceMtgBlockId: z.string().optional(),
  cardCount: z.number().int().nonnegative(),
});

const permissionDeniedPayload = z.object({
  permission: z.string(),
  source: z.enum(["ui", "api", "webhook", "test"]),
});

export const EVENT_PAYLOAD_SCHEMAS = {
  [INVENTORY_EVENT_TYPES.BLOCK_SEALED]: blockSealedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE]: blockLifecyclePayload,
  [INVENTORY_EVENT_TYPES.BLOCK_MOVED]: blockMovedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_REMOVED]: blockRemovedPayload,
  [INVENTORY_EVENT_TYPES.STAGING_FORMALIZED]: stagingFormalizedPayload,
  [INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE]: stagingUndoFormalizePayload,
  [INVENTORY_EVENT_TYPES.STAGING_DELETED]: stagingDeletedPayload,
  [INVENTORY_EVENT_TYPES.ORDER_IMPORTED]: orderImportedPayload,
  [INVENTORY_EVENT_TYPES.PICK_LIST_CREATED]: pickListCreatedPayload,
  [INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED]: pickItemAllocatedPayload,
  [INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED]: pickItemPickedPayload,
  [INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT]: pickItemShortPayload,
  [INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED]: pickItemSubstitutedPayload,
  [INVENTORY_EVENT_TYPES.PICK_COUNTER]: pickCounterPayload,
  [INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED]: inventoryDecrementedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED]: blockQuarantinedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED]: blockQuarantineClearedPayload,
  [INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED]: stagingCorrectionCreatedPayload,
  [INVENTORY_EVENT_TYPES.PERMISSION_DENIED]: permissionDeniedPayload,
} as const;

export type EventPayloadMap = {
  [INVENTORY_EVENT_TYPES.BLOCK_SEALED]: z.infer<typeof blockSealedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE]: z.infer<typeof blockLifecyclePayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_MOVED]: z.infer<typeof blockMovedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_REMOVED]: z.infer<typeof blockRemovedPayload>;
  [INVENTORY_EVENT_TYPES.STAGING_FORMALIZED]: z.infer<typeof stagingFormalizedPayload>;
  [INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE]: z.infer<typeof stagingUndoFormalizePayload>;
  [INVENTORY_EVENT_TYPES.STAGING_DELETED]: z.infer<typeof stagingDeletedPayload>;
  [INVENTORY_EVENT_TYPES.ORDER_IMPORTED]: z.infer<typeof orderImportedPayload>;
  [INVENTORY_EVENT_TYPES.PICK_LIST_CREATED]: z.infer<typeof pickListCreatedPayload>;
  [INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED]: z.infer<typeof pickItemAllocatedPayload>;
  [INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED]: z.infer<typeof pickItemPickedPayload>;
  [INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT]: z.infer<typeof pickItemShortPayload>;
  [INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED]: z.infer<typeof pickItemSubstitutedPayload>;
  [INVENTORY_EVENT_TYPES.PICK_COUNTER]: z.infer<typeof pickCounterPayload>;
  [INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED]: z.infer<typeof inventoryDecrementedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED]: z.infer<typeof blockQuarantinedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED]: z.infer<typeof blockQuarantineClearedPayload>;
  [INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED]: z.infer<typeof stagingCorrectionCreatedPayload>;
  [INVENTORY_EVENT_TYPES.PERMISSION_DENIED]: z.infer<typeof permissionDeniedPayload>;
};

export type RecordableEventType = keyof typeof EVENT_PAYLOAD_SCHEMAS;

export function getEventCategory(eventType: string): EventCategory {
  if (eventType.startsWith("block.")) return "blocks";
  if (eventType.startsWith("staging.")) return "staging";
  if (
    eventType.startsWith("order.") ||
    eventType.startsWith("pick.") ||
    eventType.startsWith("inventory.")
  ) {
    return "orders";
  }
  return "all";
}

export function categoryEventTypes(category: EventCategory): string[] | undefined {
  switch (category) {
    case "blocks":
      return Object.values(INVENTORY_EVENT_TYPES).filter((t) => t.startsWith("block."));
    case "staging":
      return Object.values(INVENTORY_EVENT_TYPES).filter((t) => t.startsWith("staging."));
    case "orders":
      return Object.values(INVENTORY_EVENT_TYPES).filter(
        (t) =>
          t.startsWith("order.") || t.startsWith("pick.") || t.startsWith("inventory."),
      );
    default:
      return undefined;
  }
}
