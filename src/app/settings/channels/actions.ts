"use server";

import { revalidatePath } from "next/cache";
import { requireAuthContext } from "@/lib/context/domain-context";
import { roleCanPerform, PERMISSIONS } from "@/lib/auth/permissions";
import { updateChannelSettings } from "@/lib/channels/config";

export async function updateChannelBufferAction(
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireAuthContext("ui");
    if (!roleCanPerform(ctx.role, PERMISSIONS.SETTINGS_STRUCTURE)) {
      return { ok: false, message: "You do not have permission to update channels." };
    }

    const channelId = String(formData.get("channelId") ?? "");
    const bufferRaw = String(formData.get("reserveBufferQty") ?? "0");
    const reserveBufferQty = Number.parseInt(bufferRaw, 10);

    if (!channelId || !Number.isInteger(reserveBufferQty) || reserveBufferQty < 0) {
      return { ok: false, message: "Invalid channel or buffer value." };
    }

    await updateChannelSettings(channelId, { reserveBufferQty });
    revalidatePath("/settings/channels");
    return { ok: true, message: "Channel settings saved." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update channel.",
    };
  }
}
