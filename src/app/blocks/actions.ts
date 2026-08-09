"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { RemoveBlockError, removeBlockByBlockId } from "@/lib/blocks/remove";
import { getRemoveRedirectUrl } from "@/lib/blocks/remove-redirect";
import {
  sealBlocksFromStagingImport,
  sealOpenBlocksByInternalIds,
  sealOpenBlocksInBin,
} from "@/lib/blocks/seal";
import {
  LifecycleError,
  transitionBlockStatus,
  type LifecycleTransition,
} from "@/lib/blocks/lifecycle";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import { BlockMoveError, bulkMoveBlocksInBin, bulkMoveBlocksToBin, moveBlockToBin as moveBlockToBinLib } from "@/lib/blocks/move";
import { recordCounterPick } from "@/lib/pick/counter-pick";
import { clearBlockPickHold } from "@/lib/blocks/quarantine";
import { PickError } from "@/lib/pick/errors";

export type BlockActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function moveBlockToBin(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const blockId = (formData.get("blockId") as string)?.trim();
  const binId = (formData.get("binId") as string)?.trim();

  if (!blockId) {
    return { ok: false, message: "Block not found" };
  }

  if (!binId) {
    return { ok: false, message: "Select a bin" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.BLOCK_MOVE);
    const result = await moveBlockToBinLib(ctx, blockId, binId);
    if (result.skipped) {
      return { ok: true, message: "Already in this bin" };
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    const message = error instanceof BlockMoveError ? error.message : "Move failed";
    return { ok: false, message };
  }

  revalidatePath("/blocks");
  revalidatePath(`/blocks/${blockId}`);

  return { ok: true, message: "Block moved" };
}

export async function bulkMoveBlocksAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const targetBinId = (formData.get("targetBinId") as string)?.trim();
  const mode = (formData.get("mode") as string)?.trim();

  if (!targetBinId) {
    return { ok: false, message: "Select a destination bin" };
  }

  try {
    if (mode === "bin") {
      const sourceBinId = (formData.get("sourceBinId") as string)?.trim();
      if (!sourceBinId) {
        return { ok: false, message: "Select a source bin" };
      }
    const ctx = await requirePermissionContext(PERMISSIONS.BLOCK_MOVE);
      const result = await bulkMoveBlocksInBin(ctx, sourceBinId, targetBinId);
      revalidatePath("/blocks");
      return {
        ok: true,
        message: `Moved ${result.moved} block${result.moved === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already in destination)` : ""}`,
      };
    }

    const blockIds = formData.getAll("blockIds").map((v) => String(v).trim()).filter(Boolean);
    const ctx = await requirePermissionContext(PERMISSIONS.BLOCK_MOVE);
    const result = await bulkMoveBlocksToBin(ctx, blockIds, targetBinId);
    revalidatePath("/blocks");
    for (const id of result.blockIds) {
      revalidatePath(`/blocks/${id}`);
    }
    return {
      ok: true,
      message: `Moved ${result.moved} block${result.moved === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} skipped)` : ""}`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    const message = error instanceof BlockMoveError ? error.message : "Bulk move failed";
    return { ok: false, message };
  }
}

function revalidateBlockPaths(blockId?: string) {
  revalidatePath("/blocks");
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/staging");
  if (blockId) {
    revalidatePath(`/blocks/${blockId}`);
  }
}

export async function sealBlockAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const blockId = (formData.get("blockId") as string)?.trim();
  if (!blockId) {
    return { ok: false, message: "Block not found" };
  }

  let ctx;
  try {
    ctx = await requirePermissionContext(PERMISSIONS.BLOCK_SEAL);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const block = await db.block.findUnique({
    where: { blockId },
    select: { id: true },
  });

  if (!block) {
    return { ok: false, message: "Block not found" };
  }

  const outcome = await sealOpenBlocksByInternalIds(ctx, [block.id]);

  if (outcome.sealed === 0) {
    if (outcome.message === "No blocks to seal") {
      return { ok: false, message: "Block not found" };
    }
    return { ok: false, message: outcome.message };
  }

  revalidateBlockPaths(blockId);
  return { ok: true, message: "Block sealed" };
}

const LIFECYCLE_TRANSITIONS = new Set<LifecycleTransition>([
  "ACTIVATE",
  "ARCHIVE",
  "LIQUIDATE",
]);

export async function lifecycleBlockAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const blockId = (formData.get("blockId") as string)?.trim();
  const transition = (formData.get("transition") as string)?.trim();

  if (!blockId) {
    return { ok: false, message: "Block not found" };
  }

  if (!LIFECYCLE_TRANSITIONS.has(transition as LifecycleTransition)) {
    return { ok: false, message: "Invalid lifecycle action" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.BLOCK_LIFECYCLE);
    const outcome = await transitionBlockStatus(
      ctx,
      blockId,
      transition as LifecycleTransition,
    );
    revalidateBlockPaths(blockId);
    return { ok: true, message: outcome.message };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof LifecycleError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Lifecycle update failed" };
  }
}

export async function removeBlockAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const blockId = (formData.get("blockId") as string)?.trim();
  const confirmation = (formData.get("confirmation") as string)?.trim();

  if (!blockId) {
    return { ok: false, message: "Block not found" };
  }

  if (confirmation !== blockId) {
    return { ok: false, message: `Type ${blockId} to confirm` };
  }

  let result;
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.BLOCK_REMOVE);
    result = await removeBlockByBlockId(ctx, blockId);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof RemoveBlockError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Remove failed" };
  }

  revalidatePath("/blocks");
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/staging");
  revalidatePath("/settings");
  if (result.stagingImportId) {
    revalidatePath(`/staging/${result.stagingImportId}`);
  }

  redirect(getRemoveRedirectUrl(result));
}

export async function sealBlocksByBinAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const binId = (formData.get("binId") as string)?.trim();
  if (!binId) {
    return { ok: false, message: "Select a bin" };
  }

  let ctx;
  try {
    ctx = await requirePermissionContext(PERMISSIONS.BLOCK_SEAL);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const outcome = await sealOpenBlocksInBin(ctx, binId);

  if (outcome.sealed === 0) {
    return { ok: false, message: outcome.message };
  }

  revalidateBlockPaths();
  revalidatePath("/settings");
  return { ok: true, message: outcome.message };
}

export async function sealBlocksByImportAction(
  _prev: BlockActionResult | null,
  formData: FormData,
): Promise<BlockActionResult> {
  const importId = (formData.get("importId") as string)?.trim();
  if (!importId) {
    return { ok: false, message: "Import not found" };
  }

  let ctx;
  try {
    ctx = await requirePermissionContext(PERMISSIONS.BLOCK_SEAL);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  const outcome = await sealBlocksFromStagingImport(ctx, importId);

  if (outcome.sealed === 0) {
    return { ok: false, message: outcome.message };
  }

  revalidateBlockPaths();
  revalidatePath(`/staging/${importId}`);
  return { ok: true, message: outcome.message };
}

export async function counterPickAction(
  mtgBlockId: string,
  position: number,
): Promise<BlockActionResult> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
    const result = await recordCounterPick({ mtgBlockId, position }, ctx);
    revalidateBlockPaths(mtgBlockId);
    revalidatePath("/pick");
    revalidatePath("/activity");
    return {
      ok: true,
      message: `Counter pick: ${result.cardName} from ${result.mtgBlockId} pos ${result.position}`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Counter pick failed",
    };
  }
}

export async function clearQuarantineAction(mtgBlockId: string): Promise<BlockActionResult> {
  try {
    const block = await db.block.findUnique({ where: { blockId: mtgBlockId } });
    if (!block) return { ok: false, message: "Block not found" };
    const ctx = await requirePermissionContext(PERMISSIONS.PICK_OPERATIONS);
    await clearBlockPickHold(block.id, ctx);
    revalidateBlockPaths(mtgBlockId);
    revalidatePath("/pick");
    revalidatePath("/activity");
    return { ok: true, message: `Quarantine cleared on ${mtgBlockId}` };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Clear quarantine failed",
    };
  }
}
