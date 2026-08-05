"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

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
