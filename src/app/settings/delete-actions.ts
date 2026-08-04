"use server";

import { revalidatePath } from "next/cache";
import type { SettingsActionResult } from "./actions";
import {
  deleteAllBins,
  deleteAllCardInventory,
  deleteAllInventoryData,
  deleteAllShelves,
} from "@/lib/data-reset";

const REVALIDATE_PATHS = ["/", "/settings", "/blocks", "/staging", "/orders", "/pick", "/analytics"];

function revalidateInventoryPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function validateConfirmation(formData: FormData): SettingsActionResult | null {
  const confirmation = (formData.get("confirmation") as string)?.trim();
  if (confirmation !== "DELETE") {
    return { ok: false, message: "Type DELETE to confirm" };
  }
  return null;
}

export async function deleteCardInventoryAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const error = validateConfirmation(formData);
  if (error) return error;

  try {
    await deleteAllCardInventory();
    revalidateInventoryPaths();
    return { ok: true, message: "Card inventory cleared" };
  } catch {
    return { ok: false, message: "Delete failed" };
  }
}

export async function deleteAllBinsAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const error = validateConfirmation(formData);
  if (error) return error;

  try {
    await deleteAllBins();
    revalidateInventoryPaths();
    return { ok: true, message: "All bins deleted" };
  } catch {
    return { ok: false, message: "Delete failed" };
  }
}

export async function deleteAllShelvesAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const error = validateConfirmation(formData);
  if (error) return error;

  try {
    await deleteAllShelves();
    revalidateInventoryPaths();
    return { ok: true, message: "All shelves deleted" };
  } catch {
    return { ok: false, message: "Delete failed" };
  }
}

export async function deleteAllInventoryAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const error = validateConfirmation(formData);
  if (error) return error;

  try {
    await deleteAllInventoryData();
    revalidateInventoryPaths();
    return { ok: true, message: "All inventory data deleted" };
  } catch {
    return { ok: false, message: "Delete failed" };
  }
}
