"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { expandManaboxRowsToUnits, parseManaboxCsv } from "@/lib/manabox/csv-import";
import { applyBreakdownToImport, getDefaultStagingTargetCount } from "@/lib/staging/apply-breakdown";
import { getDefaultFormalizeBinId } from "@/lib/staging/defaults";
import { FormalizeError, formalizeStagingImport } from "@/lib/staging/formalize";
import { buildStagingReviewGroups } from "@/lib/staging/review";
import {
  UndoFormalizeError,
  undoFormalizeImport,
} from "@/lib/staging/undo-formalize";
import {
  createUploadLogger,
  formatFileSize,
  type StagingUploadResult,
} from "@/lib/staging/upload-log";

export type StagingActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type { StagingUploadResult } from "@/lib/staging/upload-log";

const REVALIDATE_PATHS = ["/", "/staging", "/blocks", "/analytics"];
const INSERT_CHUNK = 500;

function revalidateStagingPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function fail(log: ReturnType<typeof createUploadLogger>, message: string): StagingUploadResult {
  log.error(message);
  return { ok: false, log: log.entries, message };
}

export async function uploadStagingCsv(
  _prev: StagingUploadResult | null,
  formData: FormData,
): Promise<StagingUploadResult> {
  const log = createUploadLogger();

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return fail(log, "Select a CSV file");
  }

  log.info(`Reading file: ${file.name} (${formatFileSize(file.size)})`);

  log.info("Checking shelves and bins…");
  const [shelfCount, binCount] = await Promise.all([
    db.shelf.count(),
    db.bin.count(),
  ]);
  if (shelfCount === 0 || binCount === 0) {
    return fail(log, "Configure shelves and bins in Settings first");
  }
  log.info(`Found ${shelfCount} shelf(es) and ${binCount} bin(s)`);

  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return fail(log, "Failed to read CSV file");
  }

  let rows;
  let parseErrors: string[] = [];
  try {
    ({ rows, errors: parseErrors } = await parseManaboxCsv(raw));
  } catch {
    return fail(log, "Failed to parse CSV");
  }

  if (rows.length === 0) {
    const detail = parseErrors[0] ?? "No valid rows found";
    return fail(log, detail);
  }

  log.info(`Parsed ${rows.length} CSV row(s)`);
  if (parseErrors.length > 0) {
    log.warn(`${parseErrors.length} row(s) skipped during parse`);
    for (const err of parseErrors.slice(0, 5)) {
      log.warn(err);
    }
    if (parseErrors.length > 5) {
      log.warn(`… and ${parseErrors.length - 5} more parse warning(s)`);
    }
  }

  const targetCount = await getDefaultStagingTargetCount();
  log.info(`Target count: ${targetCount} cards per block`);

  const units = expandManaboxRowsToUnits(rows);
  log.info(`Expanded to ${units.length} physical card(s)`);

  try {
    log.info("Saving staging import…");
    const stagingImport = await db.stagingImport.create({
      data: {
        filename: file.name,
        rowCount: units.length,
        status: "PARSED",
        targetCount,
      },
    });

    for (let i = 0; i < units.length; i += INSERT_CHUNK) {
      const chunk = units.slice(i, i + INSERT_CHUNK);
      await db.stagingCard.createMany({
        data: chunk.map((unit) => ({
          stagingImportId: stagingImport.id,
          scryfallId: unit.scryfallId,
          name: unit.name,
          setCode: unit.setCode,
          collectorNumber: unit.collectorNumber,
          finish: unit.finish,
          language: unit.language,
          condition: unit.condition,
          quantity: 1,
          expansionIndex: unit.expansionIndex,
          sourceRow: unit.sourceRow,
        })),
      });
      if (units.length > INSERT_CHUNK) {
        log.info(`Saved cards ${Math.min(i + INSERT_CHUNK, units.length)} / ${units.length}`);
      }
    }

    log.info("Assigning positions and block breakdown…");
    const suggestedBlocks = await applyBreakdownToImport(stagingImport.id, targetCount);
    log.info(`Suggested ${suggestedBlocks} block(s)`);
    log.success("Import ready for review — MTG block IDs are assigned when you formalize");

    revalidateStagingPaths();

    return {
      ok: true,
      importId: stagingImport.id,
      log: log.entries,
      summary: {
        filename: file.name,
        csvRows: rows.length,
        units: units.length,
        suggestedBlocks,
        targetCount,
        parseWarnings: parseErrors.length,
      },
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return fail(log, `Import failed: ${detail}`);
  }
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
      if (Number.isFinite(blockIndex) && value.trim()) {
        binAssignments[blockIndex] = value.trim();
      }
    }
  }

  const stagingImport = await db.stagingImport.findUnique({
    where: { id: importId },
    include: { cards: true },
  });

  if (!stagingImport) {
    return { ok: false, message: "Import not found" };
  }

  const groups = buildStagingReviewGroups(stagingImport.cards);
  const defaultBinId = await getDefaultFormalizeBinId();

  for (const group of groups) {
    if (!binAssignments[group.blockIndex] && defaultBinId) {
      binAssignments[group.blockIndex] = defaultBinId;
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

export async function deleteStagingImportAction(
  _prev: StagingActionResult | null,
  formData: FormData,
): Promise<StagingActionResult> {
  const importId = (formData.get("importId") as string)?.trim();
  if (!importId) {
    return { ok: false, message: "Import not found" };
  }

  const stagingImport = await db.stagingImport.findUnique({ where: { id: importId } });
  if (!stagingImport) {
    return { ok: false, message: "Import not found" };
  }

  if (stagingImport.status === "ASSIGNED") {
    const stillLinked = await db.stagingCard.count({
      where: { stagingImportId: importId, assignedBlockId: { not: null } },
    });
    if (stillLinked > 0) {
      return {
        ok: false,
        message: "Already formalized — use Undo formalize on the import review page, or remove blocks first",
      };
    }
  }

  await db.stagingImport.delete({ where: { id: importId } });
  revalidateStagingPaths();
  revalidatePath(`/staging/${importId}`);

  return { ok: true, message: "Staging deleted" };
}

export async function undoFormalizeImportAction(
  _prev: StagingActionResult | null,
  formData: FormData,
): Promise<StagingActionResult> {
  const importId = (formData.get("importId") as string)?.trim();
  const confirmation = (formData.get("confirmation") as string)?.trim();

  if (!importId) {
    return { ok: false, message: "Import not found" };
  }

  if (confirmation !== "UNDO") {
    return { ok: false, message: "Type UNDO to confirm" };
  }

  try {
    const result = await undoFormalizeImport(importId);
    revalidateStagingPaths();
    revalidatePath("/settings");
    revalidatePath(`/staging/${importId}`);

    return {
      ok: true,
      message: `Undid formalize for "${result.filename}" — removed ${result.blocksRemoved} block${result.blocksRemoved === 1 ? "" : "s"}. Re-upload your export file on Staging to start over. MTG IDs are not reused.`,
    };
  } catch (error) {
    if (error instanceof UndoFormalizeError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Undo failed" };
  }
}
