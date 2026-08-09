"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import { quarantineBlockByMtgId, clearBlockPickHold } from "@/lib/blocks/quarantine";
import { holdPickList, resumePickList } from "@/lib/pick/hold-list";
import { markPickItemPicked, markPickItemShort, markPickItemSubstituted } from "@/lib/pick/mark-item";
import { reallocatePendingPickItems } from "@/lib/pick/reallocate";
import { PickError } from "@/lib/pick/errors";
import type { ShortReason } from "@/lib/pick/types";
import { SHORT_REASONS } from "@/lib/pick/types";

export interface PickActionResult {
  ok: boolean;
  message: string;
}

export async function pickItemAction(pickItemId: string, pickListId: string): Promise<void> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
    await markPickItemPicked(pickItemId, ctx);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      revalidatePath(`/pick/${pickListId}`);
      throw new Error(error.message);
    }
    const message = error instanceof PickError ? error.message : "Pick failed";
    revalidatePath(`/pick/${pickListId}`);
    throw new Error(message);
  }
  revalidatePath(`/pick/${pickListId}`);
  revalidatePath("/pick");
  revalidatePath("/activity");
}

export async function substitutePickItemAction(
  pickItemId: string,
  pickListId: string,
  alternateCardLineId: string,
): Promise<void> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    await markPickItemSubstituted(pickItemId, alternateCardLineId, ctx);
  } catch (error) {
    const message = error instanceof PickError ? error.message : "Substitute failed";
    revalidatePath(`/pick/${pickListId}`);
    throw new Error(message);
  }
  revalidatePath(`/pick/${pickListId}`);
  revalidatePath("/pick");
  revalidatePath("/activity");
}

export async function shortPickItemAction(
  pickItemId: string,
  pickListId: string,
  reason: string,
): Promise<PickActionResult> {
  const shortReason = SHORT_REASONS.includes(reason as ShortReason)
    ? (reason as ShortReason)
    : "OTHER";

  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    await markPickItemShort(pickItemId, shortReason, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/pick");
    revalidatePath("/activity");
    return { ok: true, message: "Marked as short" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Could not mark short",
    };
  }
}

export async function holdPickListAction(
  pickListId: string,
  reason: string,
): Promise<PickActionResult> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    await holdPickList(pickListId, reason, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/pick");
    return { ok: true, message: "Pick list on hold" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Could not hold list",
    };
  }
}

export async function resumePickListAction(pickListId: string): Promise<PickActionResult> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    await resumePickList(pickListId, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/pick");
    return { ok: true, message: "Pick list resumed" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Could not resume list",
    };
  }
}

export async function reallocatePickListAction(pickListId: string): Promise<PickActionResult> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    const result = await reallocatePendingPickItems(pickListId, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/pick");
    return {
      ok: true,
      message: `Reallocated ${result.reallocated}, still short ${result.stillShort}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Reallocate failed",
    };
  }
}

export async function quarantineBlockAction(
  mtgBlockId: string,
  pickListId: string,
  reason: string,
): Promise<PickActionResult> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    await quarantineBlockByMtgId(mtgBlockId, reason, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/blocks");
    return { ok: true, message: `${mtgBlockId} quarantined` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Quarantine failed",
    };
  }
}

export async function clearBlockHoldAction(
  mtgBlockId: string,
  pickListId: string,
): Promise<PickActionResult> {
  const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
  try {
    const block = await import("@/lib/db").then(({ db }) =>
      db.block.findUnique({ where: { blockId: mtgBlockId } }),
    );
    if (!block) throw new PickError("Block not found");
    await clearBlockPickHold(block.id, ctx);
    revalidatePath(`/pick/${pickListId}`);
    revalidatePath("/blocks");
    return { ok: true, message: `${mtgBlockId} hold cleared` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Clear hold failed",
    };
  }
}
