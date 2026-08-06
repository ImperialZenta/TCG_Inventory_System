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

  await db.$transaction([
    db.block.update({
      where: { id: block.id },
      data: { binId: targetBin.id },
    }),
    db.auditLog.create({
      data: {
        blockId: block.id,
        action: "MOVED_BIN",
        details: `${fromLabel} → ${toLabel}`,
      },
    }),
  ]);

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
