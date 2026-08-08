"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SYSTEM_CONTEXT } from "@/lib/context/domain-context";
import { createPickListFromLines } from "@/lib/pick/create-pick-list-from-lines";
import {
  parseTcgplayerPullsheetCsv,
  pullsheetRowsToPickLines,
} from "@/lib/tcgplayer/parse-pullsheet";
import { createCorrectionImport } from "@/lib/staging/create-correction-import";
import { PickError } from "@/lib/pick/errors";

export interface PickImportActionResult {
  ok: boolean;
  message: string;
}

export async function importTcgplayerPullsheetAction(
  formData: FormData,
): Promise<PickImportActionResult> {
  const file = formData.get("pullsheet");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Select a TCGplayer pullsheet CSV" };
  }

  try {
    const csv = await file.text();
    const parsed = parseTcgplayerPullsheetCsv(csv);
    if (parsed.lines.length === 0) {
      return {
        ok: false,
        message: parsed.errors[0] ?? "No lines found in pullsheet",
      };
    }

    const result = await createPickListFromLines(
      pullsheetRowsToPickLines(parsed.lines),
      {
        sourceLabel: "tcgplayer-pullsheet",
        notes: file.name,
      },
      SYSTEM_CONTEXT,
    );

    revalidatePath("/pick");
    redirect(`/pick/${result.pickListId}`);
  } catch (error) {
    if (error instanceof PickError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Import failed",
    };
  }
}

export async function createCorrectionImportAction(
  formData: FormData,
): Promise<PickImportActionResult> {
  const pickListId = (formData.get("pickListId") as string)?.trim();
  const sourceMtgBlockId = (formData.get("sourceMtgBlockId") as string)?.trim() || undefined;
  const notes = (formData.get("notes") as string)?.trim() || undefined;
  const cardsRaw = (formData.get("cards") as string)?.trim();

  if (!pickListId) {
    return { ok: false, message: "Pick list is required" };
  }

  let cards: { name: string; setCode: string }[];
  try {
    cards = JSON.parse(cardsRaw || "[]") as { name: string; setCode: string }[];
  } catch {
    return { ok: false, message: "Invalid card list" };
  }

  if (cards.length === 0) {
    return { ok: false, message: "Add at least one card" };
  }

  try {
    const { importId } = await createCorrectionImport(
      {
        filename: `correction-${Date.now()}.csv`,
        cards,
        sourcePickListId: pickListId,
        sourceMtgBlockId,
        sourceNotes: notes,
      },
      SYSTEM_CONTEXT,
    );

    revalidatePath("/staging");
    revalidatePath("/activity");
    redirect(`/staging/${importId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Correction import failed",
    };
  }
}
