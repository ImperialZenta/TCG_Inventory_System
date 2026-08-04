"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseManaboxCsv } from "@/lib/manabox/csv-import";
import { applyBreakdownToImport, getDefaultStagingTargetCount } from "@/lib/staging/apply-breakdown";
import { FormalizeError, formalizeStagingImport } from "@/lib/staging/formalize";

export type StagingActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const REVALIDATE_PATHS = ["/", "/staging", "/blocks", "/analytics"];

function revalidateStagingPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function uploadStagingCsv(
  _prev: StagingActionResult | null,
  formData: FormData,
): Promise<StagingActionResult> {
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Select a CSV file" };
  }

  const shelfCount = await db.shelf.count();
  const binCount = await db.bin.count();
  if (shelfCount === 0 || binCount === 0) {
    return { ok: false, message: "Configure shelves and bins in Settings first" };
  }

  const raw = await file.text();
  let rows;
  let errors: string[] = [];
  try {
    ({ rows, errors } = await parseManaboxCsv(raw));
  } catch {
    return { ok: false, message: "Failed to parse CSV" };
  }

  if (rows.length === 0) {
    const detail = errors[0] ?? "No valid rows found";
    return { ok: false, message: detail };
  }

  const targetCount = await getDefaultStagingTargetCount();

  const stagingImport = await db.stagingImport.create({
    data: {
      filename: file.name,
      rowCount: rows.length,
      status: "PARSED",
      targetCount,
      cards: {
        create: rows.map((row) => ({
          scryfallId: row.scryfallId,
          name: row.name,
          setCode: row.setCode,
          collectorNumber: row.collectorNumber,
          finish: row.finish,
          language: row.language,
          condition: row.condition,
          quantity: row.quantity,
          sourceRow: row.sourceRow,
        })),
      },
    },
  });

  await applyBreakdownToImport(stagingImport.id, targetCount);
  revalidateStagingPaths();
  redirect(`/staging/${stagingImport.id}`);
}

export async function recalculateBreakdownAction(
  _prev: StagingActionResult | null,
  formData: FormData,
): Promise<StagingActionResult> {
  const importId = (formData.get("importId") as string)?.trim();
  const targetCount = Number(formData.get("targetCount"));

  if (!importId) {
    return { ok: false, message: "Import not found" };
  }

  if (!Number.isFinite(targetCount) || targetCount < 1) {
    return { ok: false, message: "Enter a valid target count" };
  }

  const stagingImport = await db.stagingImport.findUnique({ where: { id: importId } });
  if (!stagingImport) {
    return { ok: false, message: "Import not found" };
  }

  if (stagingImport.status === "ASSIGNED") {
    return { ok: false, message: "Import already formalized" };
  }

  try {
    await applyBreakdownToImport(importId, targetCount);
    revalidatePath(`/staging/${importId}`);
    revalidatePath("/staging");
    return { ok: true, message: "Breakdown updated" };
  } catch {
    return { ok: false, message: "Recalculate failed" };
  }
}

export async function formalizeStagingImportAction(
  _prev: StagingActionResult | null,
  formData: FormData,
): Promise<StagingActionResult> {
  const importId = (formData.get("importId") as string)?.trim();
  if (!importId) {
    return { ok: false, message: "Import not found" };
  }

  const binAssignments: Record<number, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("bin_") && typeof value === "string") {
      const blockIndex = Number.parseInt(key.slice(4), 10);
      if (Number.isFinite(blockIndex)) {
        binAssignments[blockIndex] = value;
      }
    }
  }

  try {
    const blockIds = await formalizeStagingImport(importId, binAssignments);
    revalidateStagingPaths();
    return {
      ok: true,
      message: `Created ${blockIds.length} block(s): ${blockIds.join(", ")}`,
    };
  } catch (error) {
    if (error instanceof FormalizeError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Formalize failed" };
  }
}
