"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { suggestNextBinId, suggestNextShelfCode } from "@/lib/blocks";

export type SettingsActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function createShelf(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const code = (formData.get("code") as string)?.trim().toUpperCase();
  const label = (formData.get("label") as string)?.trim() || null;

  if (!code) {
    return { ok: false, message: "Shelf code required" };
  }

  const existing = await db.shelf.findUnique({ where: { code } });
  if (existing) {
    return { ok: false, message: "Already exists" };
  }

  const maxOrder = await db.shelf.aggregate({ _max: { sortOrder: true } });

  await db.shelf.create({
    data: {
      code,
      label,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Shelf added" };
}

export async function createBin(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const shelfCode = (formData.get("shelfCode") as string)?.trim().toUpperCase();
  const binId = (formData.get("binId") as string)?.trim().toUpperCase();
  const capacity = Number(formData.get("capacity") ?? 4);
  const label = (formData.get("label") as string)?.trim() || null;

  if (!shelfCode) {
    return { ok: false, message: "Select a shelf" };
  }

  if (!binId) {
    return { ok: false, message: "Bin ID required" };
  }

  const shelf = await db.shelf.findUnique({ where: { code: shelfCode } });
  if (!shelf) {
    return { ok: false, message: "Shelf not found" };
  }

  const existing = await db.bin.findUnique({ where: { binId } });
  if (existing) {
    return { ok: false, message: "Already exists" };
  }

  const maxOrder = await db.bin.aggregate({
    where: { shelfId: shelf.id },
    _max: { sortOrder: true },
  });

  await db.bin.create({
    data: {
      binId,
      shelfId: shelf.id,
      capacity: capacity > 0 ? capacity : 4,
      label,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Bin added" };
}

export async function updateDefaultTargetCount(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const value = (formData.get("targetCount") as string)?.trim();
  if (!value || Number.isNaN(Number(value)) || Number(value) < 1) {
    return { ok: false, message: "Enter a valid number" };
  }

  await db.appSetting.upsert({
    where: { key: "default_staging_target_count" },
    update: { value },
    create: { key: "default_staging_target_count", value },
  });

  revalidatePath("/settings");
  revalidatePath("/staging");
  return { ok: true, message: "Target count saved" };
}

export async function getSuggestedIds(shelfCode?: string) {
  const nextShelf = await suggestNextShelfCode();
  const nextBin = shelfCode
    ? await suggestNextBinId(shelfCode)
    : `${nextShelf}-B01`;

  return { nextShelf, nextBin };
}
