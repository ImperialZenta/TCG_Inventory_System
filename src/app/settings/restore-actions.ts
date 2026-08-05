"use server";

import { revalidatePath } from "next/cache";
import type { SettingsActionResult } from "./actions";
import { BackupValidationError, restoreInventoryBackup } from "@/lib/backup-restore";

const REVALIDATE_PATHS = ["/", "/settings", "/blocks", "/staging", "/orders", "/pick", "/analytics"];

function revalidateInventoryPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function restoreBackupAction(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const confirmation = (formData.get("confirmation") as string)?.trim();
  if (confirmation !== "RESTORE") {
    return { ok: false, message: "Type RESTORE to confirm" };
  }

  const file = formData.get("backup");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Select a backup JSON file" };
  }

  try {
    const raw = await file.text();
    const summary = await restoreInventoryBackup(raw);
    revalidateInventoryPaths();
    return {
      ok: true,
      message: `Restored ${summary.blockCount} blocks, ${summary.binCount} bins`,
    };
  } catch (error) {
    if (error instanceof BackupValidationError) {
      return { ok: false, message: error.message };
    }
    console.error("Restore backup failed:", error);
    const detail = error instanceof Error ? error.message : "Restore failed";
    return { ok: false, message: detail.slice(0, 200) };
  }
}
