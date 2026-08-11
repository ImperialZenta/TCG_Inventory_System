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
    case INVENTORY_EVENT_TYPES.ORDER_IMPORTED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.ORDER_IMPORTED];
      const ref = p.reference ? ` · ${p.reference}` : "";
      return `Imported ${p.channel} order · ${p.lineCount} line${p.lineCount === 1 ? "" : "s"}${ref}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_LIST_CREATED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_LIST_CREATED];
      return `Created ${p.pickListId} · ${p.itemCount} item${p.itemCount === 1 ? "" : "s"}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED];
      return `${p.mtgBlockId} pos ${p.position} · ${p.cardName}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED];
      return `Picked ${p.mtgBlockId} pos ${p.position} · ${p.cardName}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT];
      const block = p.mtgBlockId ? `${p.mtgBlockId} · ` : "";
      return `Short ${block}${p.cardName} · ${p.reason}`;
    }
    case INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED];
      const pos = p.position != null ? ` pos ${p.position}` : "";
      const label = p.cardName ?? "pick item";
      return `${p.mtgBlockId}${pos} · −${p.quantity} · ${label}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED];
      return `Substituted ${p.fromMtgBlockId} pos ${p.fromPosition} → ${p.toMtgBlockId} pos ${p.toPosition} · ${p.cardName}`;
    }
    case INVENTORY_EVENT_TYPES.PICK_COUNTER: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PICK_COUNTER];
      return `Counter pick ${p.mtgBlockId} pos ${p.position} · ${p.cardName}`;
    }
    case INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED];
      return `Quarantined ${p.mtgBlockId} · ${p.reason}`;
    }
    case INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED];
      return `Quarantine cleared ${p.mtgBlockId}`;
    }
    case INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED];
      const link = p.sourceMtgBlockId ? ` · from ${p.sourceMtgBlockId}` : "";
      return `Correction intake ${p.filename} · ${p.cardCount} card${p.cardCount === 1 ? "" : "s"}${link}`;
    }
    case INVENTORY_EVENT_TYPES.PERMISSION_DENIED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.PERMISSION_DENIED];
      return `Permission denied: ${p.permission}`;
    }
    case INVENTORY_EVENT_TYPES.UPLOAD_SESSION_CREATED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.UPLOAD_SESSION_CREATED];
      return `Created upload ${p.sessionId} · ${p.mtgBlockIds.length} block${p.mtgBlockIds.length === 1 ? "" : "s"} · ${p.channel}`;
    }
    case INVENTORY_EVENT_TYPES.UPLOAD_CSV_GENERATED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.UPLOAD_CSV_GENERATED];
      return `Generated CSV for ${p.sessionId} · ${p.rowCount} row${p.rowCount === 1 ? "" : "s"}`;
    }
    case INVENTORY_EVENT_TYPES.UPLOAD_COMPLETED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.UPLOAD_COMPLETED];
      return `Completed ${p.sessionId} · ${p.mtgBlockIds.length} block${p.mtgBlockIds.length === 1 ? "" : "s"} → ACTIVE`;
    }
    case INVENTORY_EVENT_TYPES.UPLOAD_CANCELLED: {
      const p = payload as EventPayloadMap[typeof INVENTORY_EVENT_TYPES.UPLOAD_CANCELLED];
      return `Cancelled ${p.sessionId} · ${p.mtgBlockIds.length} block${p.mtgBlockIds.length === 1 ? "" : "s"} released`;
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
    [INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED]: "Pick substituted",
    [INVENTORY_EVENT_TYPES.PICK_COUNTER]: "Counter pick",
    [INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED]: "Inventory decremented",
    [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED]: "Block quarantined",
    [INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED]: "Quarantine cleared",
    [INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED]: "Correction intake",
    [INVENTORY_EVENT_TYPES.PERMISSION_DENIED]: "Permission denied",
    [INVENTORY_EVENT_TYPES.UPLOAD_SESSION_CREATED]: "Upload session created",
    [INVENTORY_EVENT_TYPES.UPLOAD_CSV_GENERATED]: "Upload CSV generated",
    [INVENTORY_EVENT_TYPES.UPLOAD_COMPLETED]: "Upload completed",
    [INVENTORY_EVENT_TYPES.UPLOAD_CANCELLED]: "Upload cancelled",
  };
  return labels[eventType] ?? eventType;
}
