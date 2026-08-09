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
import { SYSTEM_CONTEXT } from "@/lib/context/domain-context";
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
    const result = await moveBlockToBinLib(SYSTEM_CONTEXT, blockId, binId);
    if (result.skipped) {
      return { ok: true, message: "Already in this bin" };
    }
  } catch (error) {
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
      const result = await bulkMoveBlocksInBin(SYSTEM_CONTEXT, sourceBinId, targetBinId);
      revalidatePath("/blocks");
      return {
        ok: true,
        message: `Moved ${result.moved} block${result.moved === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} already in destination)` : ""}`,
      };
    }

    const blockIds = formData.getAll("blockIds").map((v) => String(v).trim()).filter(Boolean);
    const result = await bulkMoveBlocksToBin(SYSTEM_CONTEXT, blockIds, targetBinId);
    revalidatePath("/blocks");
    for (const id of result.blockIds) {
      revalidatePath(`/blocks/${id}`);
    }
    return {
      ok: true,
      message: `Moved ${result.moved} block${result.moved === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} skipped)` : ""}`,
    };
  } catch (error) {
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

  const block = await db.block.findUnique({
    where: { blockId },
    select: { id: true },
  });

  if (!block) {
    return { ok: false, message: "Block not found" };
  }

  const outcome = await sealOpenBlocksByInternalIds([block.id]);

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
    const outcome = await transitionBlockStatus(
      blockId,
      transition as LifecycleTransition,
    );
    revalidateBlockPaths(blockId);
    return { ok: true, message: outcome.message };
  } catch (error) {
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
    result = await removeBlockByBlockId(blockId);
  } catch (error) {
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

  const outcome = await sealOpenBlocksInBin(binId);

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

  const outcome = await sealBlocksFromStagingImport(importId);

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
    const result = await recordCounterPick({ mtgBlockId, position }, SYSTEM_CONTEXT);
    revalidateBlockPaths(mtgBlockId);
    revalidatePath("/pick");
    revalidatePath("/activity");
    return {
      ok: true,
      message: `Counter pick: ${result.cardName} from ${result.mtgBlockId} pos ${result.position}`,
    };
  } catch (error) {
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
    await clearBlockPickHold(block.id, SYSTEM_CONTEXT);
    revalidateBlockPaths(mtgBlockId);
    revalidatePath("/pick");
    revalidatePath("/activity");
    return { ok: true, message: `Quarantine cleared on ${mtgBlockId}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof PickError ? error.message : "Clear quarantine failed",
    };
  }
}
