import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { OrderImportError } from "@/lib/pick/errors";
import type { ImportedOrderDTO, OrderImportResult } from "@/lib/orders/types";
import { ensureDefaultManaPoolChannel } from "@/lib/channels/config";
import { propagateAvailabilityChange } from "@/lib/channels/oversell-guard";
import {
  createOversellIncidentInTx,
  findConflictingReservation,
  type OversellOrderRef,
} from "@/lib/channels/incidents";
import { InsufficientStockError } from "@/lib/stock/errors";
import { reserveStockInTx } from "@/lib/stock/availability";
import { findStockItemByIdentityInTx } from "@/lib/stock/queries";
import type { StockIdentity } from "@/lib/stock/identity";

export interface ImportExternalOrderOptions {
  importSource?: "api" | "fixture" | "webhook" | "cron";
  channelId?: string;
}

function lineToStockIdentity(line: {
  scryfallId?: string | null;
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition: ImportedOrderDTO["lines"][number]["condition"];
  finish: ImportedOrderDTO["lines"][number]["finish"];
  language: string;
}): StockIdentity | null {
  if (!line.setCode) return null;
  return {
    scryfallId: line.scryfallId ?? null,
    name: line.name,
    setCode: line.setCode,
    collectorNumber: line.collectorNumber ?? null,
    finish: line.finish,
    language: line.language,
    condition: line.condition,
  };
}

export async function importExternalOrder(
  order: ImportedOrderDTO,
  ctx: DomainContext,
  options?: ImportExternalOrderOptions,
): Promise<OrderImportResult> {
  if (!order.manapoolOrderId) {
    throw new OrderImportError("Order id is required");
  }
  if (order.lines.length === 0) {
    throw new OrderImportError("Order has no lines");
  }

  const channel = options?.channelId
    ? await db.channel.findUnique({ where: { id: options.channelId } })
    : await ensureDefaultManaPoolChannel();
  if (!channel) {
    throw new OrderImportError("Channel not found");
  }

  const existing = await db.externalOrder.findUnique({
    where: { manapoolOrderId: order.manapoolOrderId },
    include: { _count: { select: { lines: true } } },
  });

  if (existing) {
    return {
      externalOrderId: existing.id,
      manapoolOrderId: order.manapoolOrderId,
      lineCount: existing._count.lines,
      created: false,
    };
  }

  return db.$transaction(async (tx) => {
    const created = await tx.externalOrder.create({
      data: {
        manapoolOrderId: order.manapoolOrderId,
        reference: order.reference ?? null,
        status: "IMPORTED",
        channelId: channel.id,
        lines: {
          create: order.lines.map((line) => ({
            manapoolLineId: line.manapoolLineId ?? null,
            scryfallId: line.scryfallId ?? null,
            name: line.name,
            setCode: line.setCode ?? null,
            collectorNumber: line.collectorNumber ?? null,
            condition: line.condition,
            finish: line.finish,
            language: line.language,
            quantity: line.quantity,
            priceCents: line.priceCents ?? null,
          })),
        },
      },
      include: { lines: true },
    });

    for (const line of created.lines) {
      const sourceLine = order.lines.find(
        (l) =>
          (l.manapoolLineId && l.manapoolLineId === line.manapoolLineId) ||
          (l.name === line.name && l.setCode === line.setCode),
      );
      const identity = sourceLine
        ? lineToStockIdentity(sourceLine)
        : lineToStockIdentity({
            scryfallId: line.scryfallId,
            name: line.name,
            setCode: line.setCode,
            collectorNumber: line.collectorNumber,
            condition: line.condition,
            finish: line.finish,
            language: line.language,
          });

      if (!identity) {
        await tx.externalOrderLine.update({
          where: { id: line.id },
          data: { unmatched: true },
        });
        continue;
      }

      const stockItem = await findStockItemByIdentityInTx(tx, identity);
      if (!stockItem) {
        await tx.externalOrderLine.update({
          where: { id: line.id },
          data: { unmatched: true },
        });
        continue;
      }

      try {
        await reserveStockInTx(ctx, tx, {
          stockItemId: stockItem.id,
          quantity: line.quantity,
          reference: { referenceType: "EXTERNAL_ORDER", referenceId: line.id },
        });
        await tx.externalOrderLine.update({
          where: { id: line.id },
          data: { stockItemId: stockItem.id },
        });
        await propagateAvailabilityChange(ctx, tx, stockItem.id, channel.id);
      } catch (error) {
        if (error instanceof InsufficientStockError) {
          const conflict = await findConflictingReservation(tx, stockItem.id, line.id);
          const orderRef = order.reference ?? order.manapoolOrderId;
          const refs: OversellOrderRef[] = [
            {
              channelId: channel.id,
              externalOrderId: created.id,
              channelOrderRef: orderRef,
            },
          ];
          if (conflict) {
            const conflictingLine = await tx.externalOrderLine.findFirst({
              where: { id: conflict.referenceId },
              include: { externalOrder: true },
            });
            refs.unshift({
              channelId: conflictingLine?.externalOrder?.channelId ?? channel.id,
              externalOrderId: conflictingLine?.externalOrderId ?? undefined,
              channelOrderRef:
                conflictingLine?.externalOrder?.reference ??
                conflictingLine?.externalOrder?.manapoolOrderId ??
                conflict.referenceId,
            });
          }
          await createOversellIncidentInTx(ctx, tx, {
            stockItemId: stockItem.id,
            orders: refs,
          });
          await tx.externalOrderLine.update({
            where: { id: line.id },
            data: { stockItemId: stockItem.id, oversellFlag: true, unmatched: false },
          });
          continue;
        }
        throw error;
      }
    }

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.ORDER_IMPORTED,
      payload: {
        externalOrderId: created.id,
        channel: channel.type,
        lineCount: created.lines.length,
        reference: order.reference,
        source: options?.importSource ?? (ctx.source === "webhook" ? "webhook" : ctx.source === "api" ? "api" : "api"),
      },
      externalOrderId: created.id,
    });

    return {
      externalOrderId: created.id,
      manapoolOrderId: order.manapoolOrderId,
      lineCount: created.lines.length,
      created: true,
    };
  });
}
