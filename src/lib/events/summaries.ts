import type { EventPayloadMap, RecordableEventType } from "@/lib/events/types";
import { INVENTORY_EVENT_TYPES } from "@/lib/events/types";

export function buildEventSummary<T extends RecordableEventType>(
  eventType: T,
  payload: EventPayloadMap[T],
): string {
  switch (eventType) {
    case INVENTORY_EVENT_TYPES.BLOCK_SEALED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_SEALED];
      return `Sealed ${p.mtgBlockId} · ${p.cardCount} card${p.cardCount === 1 ? "" : "s"}`;
    }
    case INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE];
      return `${p.mtgBlockId} · ${p.fromStatus} → ${p.toStatus}`;
    }
    case INVENTORY_EVENT_TYPES.BLOCK_MOVED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_MOVED];
      return `${p.mtgBlockId} · ${p.fromBin} → ${p.toBin}`;
    }
    case INVENTORY_EVENT_TYPES.BLOCK_REMOVED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_REMOVED];
      return `Removed ${p.mtgBlockId} · ${p.cardCount} card${p.cardCount === 1 ? "" : "s"} · was ${p.priorStatus}`;
    }
    case INVENTORY_EVENT_TYPES.STAGING_FORMALIZED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.STAGING_FORMALIZED];
      const ids =
        p.mtgBlockIds.length <= 3
          ? p.mtgBlockIds.join(", ")
          : `${p.mtgBlockIds.slice(0, 2).join(", ")} +${p.mtgBlockIds.length - 2} more`;
      return `Formalized ${p.filename} → ${p.mtgBlockIds.length} block${p.mtgBlockIds.length === 1 ? "" : "s"} (${ids})`;
    }
    case INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE];
      return `Undo formalize ${p.filename} · ${p.mtgBlockIds.length} block${p.mtgBlockIds.length === 1 ? "" : "s"} · ${p.cardCount} cards`;
    }
    case INVENTORY_EVENT_TYPES.STAGING_DELETED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.STAGING_DELETED];
      return `Deleted staging ${p.filename} (${p.status})`;
    }
    default:
      return eventType;
  }
}

export function formatEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    [INVENTORY_EVENT_TYPES.BLOCK_SEALED]: "Block sealed",
    [INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE]: "Block lifecycle",
    [INVENTORY_EVENT_TYPES.BLOCK_MOVED]: "Block moved",
    [INVENTORY_EVENT_TYPES.BLOCK_REMOVED]: "Block removed",
    [INVENTORY_EVENT_TYPES.STAGING_FORMALIZED]: "Staging formalized",
    [INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE]: "Undo formalize",
    [INVENTORY_EVENT_TYPES.STAGING_DELETED]: "Staging deleted",
    [INVENTORY_EVENT_TYPES.ORDER_IMPORTED]: "Order imported",
    [INVENTORY_EVENT_TYPES.PICK_LIST_CREATED]: "Pick list created",
    [INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED]: "Pick allocated",
    [INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED]: "Card picked",
    [INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT]: "Pick shorted",
    [INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED]: "Inventory decremented",
  };
  return labels[eventType] ?? eventType;
}
