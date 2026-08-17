"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import { adjustStockQuantity } from "@/lib/stock/adjust";
import { StockError } from "@/lib/stock";

export type StockActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function adjustStockQuantityAction(
  _prev: StockActionResult | null,
  formData: FormData,
): Promise<StockActionResult> {
  const stockItemId = String(formData.get("stockItemId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const targetRaw = String(formData.get("targetOnHand") ?? "").trim();
  const targetOnHand = Number.parseInt(targetRaw, 10);

  if (!stockItemId) {
    return { ok: false, message: "Stock item not found" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.STOCK_ADJUST);
    await adjustStockQuantity(ctx, { stockItemId, targetOnHand, reason });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    const message = error instanceof StockError ? error.message : "Adjustment failed";
    return { ok: false, message };
  }

  revalidatePath("/stock");
  revalidatePath(`/stock/${stockItemId}`);
  return { ok: true, message: "Quantity updated" };
}
