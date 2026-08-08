"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SYSTEM_CONTEXT } from "@/lib/context/domain-context";
import { normalizeOrdersFromFixture } from "@/lib/manapool/normalize-order";
import { importExternalOrder } from "@/lib/orders/import-order";
import { importOrdersFromManaPool } from "@/lib/orders/import-orders-batch";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { OrderImportError, PickError } from "@/lib/pick/errors";

export interface ActionResult {
  ok: boolean;
  message: string;
}

export async function importFromManaPoolAction(): Promise<ActionResult> {
  try {
    const summary = await importOrdersFromManaPool(SYSTEM_CONTEXT);
    return {
      ok: true,
      message: `Imported ${summary.imported}, skipped ${summary.skipped}${
        summary.errors.length ? `, ${summary.errors.length} errors` : ""
      }`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Import failed",
    };
  } finally {
    revalidatePath("/orders");
  }
}

export async function importFixtureAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("fixture");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Select a JSON fixture file" };
  }

  try {
    const text = await file.text();
    const json = JSON.parse(text) as unknown;
    const orders = normalizeOrdersFromFixture(json);

    let imported = 0;
    let skipped = 0;

    for (const order of orders) {
      const result = await importExternalOrder(order, SYSTEM_CONTEXT, { importSource: "fixture" });
      if (result.created) imported++;
      else skipped++;
    }

    revalidatePath("/orders");
    return {
      ok: true,
      message: `Fixture import: ${imported} new, ${skipped} skipped`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Fixture import failed",
    };
  }
}

export async function generatePickListAction(formData: FormData): Promise<void> {
  const orderId = (formData.get("orderId") as string)?.trim();
  if (!orderId) {
    redirect("/orders?error=Order%20not%20found");
  }

  let pickListId: string;
  try {
    const result = await createPickListForOrder(orderId, SYSTEM_CONTEXT);
    pickListId = result.pickListId;
  } catch (error) {
    const message =
      error instanceof PickError || error instanceof OrderImportError
        ? error.message
        : "Failed to create pick list";
    redirect(`/orders/${orderId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath("/pick");
  redirect(`/pick/${pickListId}`);
}
