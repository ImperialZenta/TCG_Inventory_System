"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import { backfillCardLinePrices } from "@/lib/pricing/backfill-prices";
import type { BackfillUnresolved } from "@/lib/pricing/backfill-prices";

export type BackfillActionResult =
  | { ok: true; message: string; unresolved: BackfillUnresolved[] }
  | { ok: false; message: string; unresolved: [] };

export async function backfillPricesAction(
  _: BackfillActionResult | null,
): Promise<BackfillActionResult> {
  void _;
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.PRICING_BACKFILL);
    const result = await backfillCardLinePrices(ctx);

    revalidatePath("/");
    revalidatePath("/blocks");
    revalidatePath("/analytics");
    revalidatePath("/settings");

    const message =
      result.updated === 0 && result.unresolved.length === 0
        ? "No unpriced card lines found."
        : `Updated ${result.updated} line(s). ${result.unresolved.length} unresolved.`;

    return {
      ok: true,
      message,
      unresolved: result.unresolved,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message, unresolved: [] };
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Backfill failed",
      unresolved: [],
    };
  }
}
