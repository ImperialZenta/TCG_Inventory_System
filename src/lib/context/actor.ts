import type { DomainContext } from "@/lib/context/domain-context";

export const SYSTEM_ACTOR = "system";

export function isAutomatedActorId(id: string): boolean {
  return id.startsWith("webhook:") || id.startsWith("cron:");
}

/** Persisted value for InventoryEvent.actor — userId, system, or null. */
export function inventoryEventActor(ctx: DomainContext): string | null {
  if (!ctx.actor?.id) {
    return null;
  }

  if (
    (ctx.source === "webhook" || ctx.source === "api") &&
    isAutomatedActorId(ctx.actor.id)
  ) {
    return SYSTEM_ACTOR;
  }

  return ctx.actor.id;
}

export interface ActorDisplayUser {
  id: string;
  displayName: string;
  email: string;
}

export function formatActorDisplay(
  actor: string | null | undefined,
  userMap: Map<string, ActorDisplayUser>,
): string {
  if (!actor) {
    return "Unattributed";
  }
  if (actor === SYSTEM_ACTOR) {
    return "System";
  }

  const user = userMap.get(actor);
  if (user) {
    return user.displayName || user.email;
  }

  return actor;
}

export async function resolveActorDisplayNames(
  actors: Array<string | null | undefined>,
): Promise<Map<string, ActorDisplayUser>> {
  const ids = [
    ...new Set(
      actors.filter((a): a is string => !!a && a !== SYSTEM_ACTOR),
    ),
  ];

  if (ids.length === 0) {
    return new Map();
  }

  const { db } = await import("@/lib/db");
  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, email: true },
  });

  return new Map(users.map((u) => [u.id, u]));
}
