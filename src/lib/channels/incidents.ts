import type { OversellResolution, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { releaseStockInTx, reserveStockInTx } from "@/lib/stock/availability";
import { promoteCardLineToStockInTx } from "@/lib/stock/promote-from-block";
import {
  listAlternateStockItems,
  listPromotableCardLines,
} from "@/lib/channels/availability";

type TransactionClient = Prisma.TransactionClient;

export interface OversellOrderRef {
  channelId: string;
  externalOrderId?: string | null;
  channelOrderRef: string;
}

export interface CreateOversellIncidentInput {
  stockItemId: string;
  orders: OversellOrderRef[];
}

export interface ResolveOversellIncidentOptions {
  note?: string;
  /** FULFILLED_ALT — reserve substitute sellable stock for fulfilment */
  alternateStockItemId?: string;
  /** PROMOTED — promote one card from chaos into stock */
  cardLineId?: string;
}

const OVERSSELL_WINDOW_MS = 5 * 60 * 1000;

export async function findConflictingReservation(
  tx: TransactionClient,
  stockItemId: string,
  excludeReferenceId?: string,
) {
  const since = new Date(Date.now() - OVERSSELL_WINDOW_MS);
  return tx.stockReservation.findFirst({
    where: {
      stockItemId,
      status: "ACTIVE",
      ...(excludeReferenceId ? { referenceId: { not: excludeReferenceId } } : {}),
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createOversellIncidentInTx(
  ctx: DomainContext,
  tx: TransactionClient,
  input: CreateOversellIncidentInput,
) {
  const incident = await tx.oversellIncident.create({
    data: {
      stockItemId: input.stockItemId,
      status: "OPEN",
      orders: {
        create: input.orders.map((order) => ({
          channelId: order.channelId,
          externalOrderId: order.externalOrderId ?? null,
          channelOrderRef: order.channelOrderRef,
        })),
      },
    },
    include: { orders: true, stockItem: true },
  });

  await recordInventoryEvent(tx, ctx, {
    eventType: INVENTORY_EVENT_TYPES.OVERSELL_DETECTED,
    payload: {
      incidentId: incident.id,
      stockItemId: incident.stockItemId,
      stockItemName: incident.stockItem.name,
      orderRefs: input.orders.map((o) => o.channelOrderRef),
    },
    stockItemId: incident.stockItemId,
  });

  return incident;
}

export async function listOversellIncidents(options?: {
  status?: "OPEN" | "RESOLVED";
  limit?: number;
}) {
  return db.oversellIncident.findMany({
    where: options?.status ? { status: options.status } : undefined,
    include: {
      stockItem: true,
      orders: { include: { channel: true, externalOrder: true } },
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
  });
}

export async function getOversellIncidentById(incidentId: string) {
  return db.oversellIncident.findUnique({
    where: { id: incidentId },
    include: {
      stockItem: true,
      orders: { include: { channel: true, externalOrder: true } },
    },
  });
}

export async function countOversellIncidents(from: Date, to: Date): Promise<number> {
  return db.oversellIncident.count({
    where: {
      createdAt: { gte: from, lte: to },
    },
  });
}

export async function getIncidentResolutionOptions(incidentId: string) {
  const incident = await getOversellIncidentById(incidentId);
  if (!incident) {
    return null;
  }

  return db.$transaction(async (tx) => ({
    alternateStockItems: await listAlternateStockItems(tx, incident.stockItemId),
    promotableCardLines: await listPromotableCardLines(tx, incident.stockItem.catalogCardId, {
      forOversellResolution: true,
    }),
  }));
}

export async function resolveOversellIncident(
  ctx: DomainContext,
  incidentId: string,
  resolution: OversellResolution,
  options: ResolveOversellIncidentOptions = {},
): Promise<void> {
  const incident = await getOversellIncidentById(incidentId);
  if (!incident) {
    throw new Error("Oversell incident not found");
  }
  if (incident.status === "RESOLVED") {
    throw new Error("Incident is already resolved");
  }

  const note = options.note;

  await db.$transaction(async (tx) => {
    if (resolution === "FULFILLED_ALT") {
      if (!options.alternateStockItemId) {
        throw new Error("Alternate stock item is required for FULFILLED_ALT resolution");
      }
      await reserveStockInTx(ctx, tx, {
        stockItemId: options.alternateStockItemId,
        quantity: 1,
        reference: {
          referenceType: "OVERSELL_RESOLUTION",
          referenceId: incidentId,
        },
      });
    }

    if (resolution === "PROMOTED") {
      if (!options.cardLineId) {
        throw new Error("Card line is required for PROMOTED resolution");
      }
      await promoteCardLineToStockInTx(ctx, tx, options.cardLineId);
    }

    if (resolution === "CANCELLED_REFUND") {
      for (const order of incident.orders) {
        if (!order.externalOrderId) continue;
        const lines = await tx.externalOrderLine.findMany({
          where: {
            externalOrderId: order.externalOrderId,
            stockItemId: incident.stockItemId,
            oversellFlag: true,
          },
        });
        for (const line of lines) {
          try {
            await releaseStockInTx(ctx, tx, {
              stockItemId: incident.stockItemId,
              quantity: line.quantity,
              reference: { referenceType: "EXTERNAL_ORDER", referenceId: line.id },
              releaseReason: "CANCEL",
            });
          } catch {
            // oversell lines usually have no reservation to release
          }
        }
      }
    }

    await tx.oversellIncident.update({
      where: { id: incidentId },
      data: {
        status: "RESOLVED",
        resolution,
        resolutionNote: note ?? null,
        resolvedAt: new Date(),
        resolvedBy: inventoryEventActor(ctx),
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.OVERSELL_RESOLVED,
      payload: {
        incidentId,
        resolution,
        note: note ?? null,
        stockItemId: incident.stockItemId,
      },
      stockItemId: incident.stockItemId,
    });
  });
}
