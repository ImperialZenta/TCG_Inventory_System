import type { DomainContext } from "@/lib/context/domain-context";
import { getManaPoolClient } from "@/lib/manapool/client";
import { importExternalOrder } from "@/lib/orders/import-order";
import type { BatchImportSummary } from "@/lib/orders/types";

export async function importOrdersFromManaPool(
  ctx: DomainContext,
  options?: { limit?: number },
): Promise<BatchImportSummary> {
  const client = getManaPoolClient();
  if (!client) {
    throw new Error("Mana Pool credentials not configured");
  }

  const limit = options?.limit ?? 50;
  const orders = await client.listSellOrders(limit, 0);

  const summary: BatchImportSummary = { imported: 0, skipped: 0, errors: [] };

  for (const order of orders) {
    try {
      const result = await importExternalOrder(order, ctx, { importSource: "api" });
      if (result.created) summary.imported++;
      else summary.skipped++;
    } catch (error) {
      summary.errors.push(
        `${order.manapoolOrderId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  return summary;
}
