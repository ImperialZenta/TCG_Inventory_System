import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { OrderImportError } from "@/lib/pick/errors";
import type { ImportedOrderDTO, OrderImportResult } from "@/lib/orders/types";

export async function importExternalOrder(
  order: ImportedOrderDTO,
  ctx: DomainContext,
  options?: { importSource?: "api" | "fixture" | "webhook" | "cron" },
): Promise<OrderImportResult> {
  if (!order.manapoolOrderId) {
    throw new OrderImportError("Order id is required");
  }
  if (order.lines.length === 0) {
    throw new OrderImportError("Order has no lines");
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

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.ORDER_IMPORTED,
      payload: {
        externalOrderId: created.id,
        channel: "MANAPOOL",
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
