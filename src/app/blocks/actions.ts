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
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { SYSTEM_CONTEXT } from "@/lib/context/domain-context";
import { recordCounterPick } from "@/lib/pick/counter-pick";
import { clearBlockPickHold } from "@/lib/blocks/quarantine";
import { PickError } from "@/lib/pick/errors";

export type BlockActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function formatBinLocation(shelfCode: string | null | undefined, binId: string): string {
  if (!shelfCode) return binId;
  return `${shelfCode} / ${binId}`;
}

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

  const block = await db.block.findUnique({
    where: { blockId },
    include: { bin: { include: { shelf: true } } },
  });

  if (!block) {
    return { ok: false, message: "Block not found" };
  }

  const targetBin = await db.bin.findUnique({
    where: { id: binId },
    include: { shelf: true },
  });

  if (!targetBin) {
    return { ok: false, message: "Bin not found" };
  }

  if (block.binId === targetBin.id) {
    return { ok: true, message: "Already in this bin" };
  }

  const fromLabel = block.bin
    ? formatBinLocation(block.bin.shelf?.code, block.bin.binId)
    : "Unassigned";
  const toLabel = formatBinLocation(targetBin.shelf?.code, targetBin.binId);

  await db.$transaction(async (tx) => {
    await tx.block.update({
      where: { id: block.id },
      data: { binId: targetBin.id },
    });
    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.BLOCK_MOVED,
      payload: {
        mtgBlockId: block.blockId,
        fromBin: fromLabel,
        toBin: toLabel,
      },
      blockId: block.id,
    });
  });

  revalidatePath("/blocks");
  revalidatePath(`/blocks/${blockId}`);
  revalidatePath("/settings");

  return { ok: true, message: `Moved to ${toLabel}` };
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
