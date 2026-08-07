import { z } from "zod";

/** Implemented v1 event types. Phase 4 types are reserved in schemas but not emitted yet. */
export const INVENTORY_EVENT_TYPES = {
  BLOCK_SEALED: "block.sealed",
  BLOCK_LIFECYCLE: "block.lifecycle",
  BLOCK_MOVED: "block.moved",
  BLOCK_REMOVED: "block.removed",
  STAGING_FORMALIZED: "staging.formalized",
  STAGING_UNDO_FORMALIZE: "staging.undo_formalize",
  STAGING_DELETED: "staging.deleted",
  // Phase 4 — reserved
  ORDER_IMPORTED: "order.imported",
  PICK_LIST_CREATED: "pick.list_created",
  PICK_ITEM_ALLOCATED: "pick.item_allocated",
  PICK_ITEM_PICKED: "pick.item_picked",
  PICK_ITEM_SHORT: "pick.item_short",
  INVENTORY_DECREMENTED: "inventory.decremented",
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

export const EVENT_PAYLOAD_SCHEMAS = {
  [INVENTORY_EVENT_TYPES.BLOCK_SEALED]: blockSealedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE]: blockLifecyclePayload,
  [INVENTORY_EVENT_TYPES.BLOCK_MOVED]: blockMovedPayload,
  [INVENTORY_EVENT_TYPES.BLOCK_REMOVED]: blockRemovedPayload,
  [INVENTORY_EVENT_TYPES.STAGING_FORMALIZED]: stagingFormalizedPayload,
  [INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE]: stagingUndoFormalizePayload,
  [INVENTORY_EVENT_TYPES.STAGING_DELETED]: stagingDeletedPayload,
} as const;

export type EventPayloadMap = {
  [INVENTORY_EVENT_TYPES.BLOCK_SEALED]: z.infer<typeof blockSealedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE]: z.infer<typeof blockLifecyclePayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_MOVED]: z.infer<typeof blockMovedPayload>;
  [INVENTORY_EVENT_TYPES.BLOCK_REMOVED]: z.infer<typeof blockRemovedPayload>;
  [INVENTORY_EVENT_TYPES.STAGING_FORMALIZED]: z.infer<typeof stagingFormalizedPayload>;
  [INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE]: z.infer<typeof stagingUndoFormalizePayload>;
  [INVENTORY_EVENT_TYPES.STAGING_DELETED]: z.infer<typeof stagingDeletedPayload>;
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
