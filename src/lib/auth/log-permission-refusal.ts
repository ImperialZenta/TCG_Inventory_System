import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import { INVENTORY_EVENT_TYPES } from "@/lib/events/types";import type { Permission } from "./permissions";

export async function logPermissionRefusal(
  ctx: DomainContext,
  permission: Permission,
): Promise<void> {
  if (!ctx.actor) {
    return;
  }

  try {
    await db.inventoryEvent.create({
      data: {
        eventType: INVENTORY_EVENT_TYPES.PERMISSION_DENIED,
        summary: `Permission denied: ${permission}`,
        payload: {
          permission,
          source: ctx.source,
        },
        actor: inventoryEventActor(ctx),
      },
    });
  } catch {
    // Refusal must still throw even if audit write fails.
  }
}
