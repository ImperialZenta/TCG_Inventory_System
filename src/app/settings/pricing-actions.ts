"use server";

import { revalidatePath } from "next/cache";
import { SYSTEM_CONTEXT } from "@/lib/context/domain-context";
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
    const result = await backfillCardLinePrices(SYSTEM_CONTEXT);

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
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Backfill failed",
      unresolved: [],
    };
  }
}
