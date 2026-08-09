"use server";

import { revalidatePath } from "next/cache";
import type { SettingsActionResult } from "./actions";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
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

function forbiddenResult(error: unknown): SettingsActionResult | null {
  if (error instanceof ForbiddenError) {
    return { ok: false, message: error.message };
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
    const ctx = await requirePermissionContext(PERMISSIONS.DANGER_ZONE);
    await deleteAllCardInventory(ctx);
    revalidateInventoryPaths();
    return { ok: true, message: "Card inventory cleared" };
  } catch (e) {
    const denied = forbiddenResult(e);
    if (denied) return denied;
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
    const ctx = await requirePermissionContext(PERMISSIONS.DANGER_ZONE);
    await deleteAllBins(ctx);
    revalidateInventoryPaths();
    return { ok: true, message: "All bins deleted" };
  } catch (e) {
    const denied = forbiddenResult(e);
    if (denied) return denied;
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
    const ctx = await requirePermissionContext(PERMISSIONS.DANGER_ZONE);
    await deleteAllShelves(ctx);
    revalidateInventoryPaths();
    return { ok: true, message: "All shelves deleted" };
  } catch (e) {
    const denied = forbiddenResult(e);
    if (denied) return denied;
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
    const ctx = await requirePermissionContext(PERMISSIONS.DANGER_ZONE);
    await deleteAllInventoryData(ctx);
    revalidateInventoryPaths();
    return { ok: true, message: "All inventory data deleted" };
  } catch (e) {
    const denied = forbiddenResult(e);
    if (denied) return denied;
    return { ok: false, message: "Delete failed" };
  }
}
