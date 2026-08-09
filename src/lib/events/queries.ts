import { db } from "@/lib/db";
import {
  categoryEventTypes,
  type EventCategory,
} from "@/lib/events/types";

export interface ListInventoryEventsOptions {
  limit?: number;
  category?: EventCategory;
  mtgBlockId?: string;
  stagingImportId?: string;
  actor?: string;
}

export interface InventoryEventRow {
  id: string;
  eventType: string;
  summary: string;
  payload: unknown;
  correlationId: string | null;
  blockId: string | null;
  stagingImportId: string | null;
  actor: string | null;
  createdAt: Date;
  block: { blockId: string } | null;
}

const DEFAULT_LIMIT = 100;

export async function listInventoryEvents(
  options: ListInventoryEventsOptions = {},
): Promise<InventoryEventRow[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const eventTypes = options.category ? categoryEventTypes(options.category) : undefined;

  const rows = await db.inventoryEvent.findMany({
    where: {
      ...(eventTypes ? { eventType: { in: eventTypes } } : {}),
      ...(options.stagingImportId ? { stagingImportId: options.stagingImportId } : {}),
      ...(options.actor ? { actor: options.actor } : {}),
    },
    include: {
      block: { select: { blockId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options.mtgBlockId ? limit * 3 : limit,
  });

  if (!options.mtgBlockId) {
    return rows.slice(0, limit);
  }

  const needle = options.mtgBlockId.toUpperCase();
  return rows
    .filter((row) => {
      if (row.block?.blockId.toUpperCase() === needle) return true;
      if (row.summary.toUpperCase().includes(needle)) return true;
      const payloadId = getMtgBlockIdFromPayload(row.eventType, row.payload);
      if (payloadId?.toUpperCase() === needle) return true;
      const p = row.payload as { mtgBlockIds?: string[] } | null;
      if (p?.mtgBlockIds?.some((id) => id.toUpperCase() === needle)) return true;
      return false;
    })
    .slice(0, limit);
}

export async function listEventsForBlock(
  internalBlockId: string,
  mtgBlockId: string,
  limit = 10,
): Promise<InventoryEventRow[]> {
  const rows = await db.inventoryEvent.findMany({
    where: {
      OR: [{ blockId: internalBlockId }, { summary: { contains: mtgBlockId, mode: "insensitive" } }],
    },
    include: {
      block: { select: { blockId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows;
}

export function getMtgBlockIdFromPayload(
  eventType: string,
  payload: unknown,
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.mtgBlockId === "string") return p.mtgBlockId;
  if (Array.isArray(p.mtgBlockIds) && p.mtgBlockIds.length === 1) {
    return String(p.mtgBlockIds[0]);
  }
  return null;
}

export function getStagingImportIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { importId?: string };
  return typeof p.importId === "string" ? p.importId : null;
}
