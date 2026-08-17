"use server";

import { revalidatePath } from "next/cache";
import type { OversellResolution } from "@prisma/client";
import { requireAuthContext } from "@/lib/context/domain-context";
import { roleCanPerform, PERMISSIONS } from "@/lib/auth/permissions";
import { resolveOversellIncident } from "@/lib/channels/incidents";

export async function resolveIncidentAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await requireAuthContext("ui");
    if (!roleCanPerform(ctx.role, PERMISSIONS.ORDER_IMPORT)) {
      return { ok: false, message: "You do not have permission to resolve incidents." };
    }

    const incidentId = String(formData.get("incidentId") ?? "");
    const resolution = String(formData.get("resolution") ?? "") as OversellResolution;
    const note = String(formData.get("note") ?? "").trim() || undefined;
    const alternateStockItemId =
      String(formData.get("alternateStockItemId") ?? "").trim() || undefined;
    const cardLineId = String(formData.get("cardLineId") ?? "").trim() || undefined;

    if (!incidentId || !resolution) {
      return { ok: false, message: "Incident and resolution are required." };
    }

    await resolveOversellIncident(ctx, incidentId, resolution, {
      note,
      alternateStockItemId,
      cardLineId,
    });
    revalidatePath("/incidents");
    revalidatePath(`/incidents/${incidentId}`);
    revalidatePath("/inventory");
    return { ok: true, message: "Incident resolved." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to resolve incident.",
    };
  }
}
