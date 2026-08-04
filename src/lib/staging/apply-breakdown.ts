import { db } from "@/lib/db";
import { assignSuggestedBlockIndices } from "@/lib/staging/breakdown";

export async function applyBreakdownToImport(importId: string, targetCount: number): Promise<void> {
  const cards = await db.stagingCard.findMany({
    where: { stagingImportId: importId },
    select: { id: true, quantity: true, sourceRow: true },
  });

  const assignments = assignSuggestedBlockIndices(cards, targetCount);

  await db.$transaction(async (tx) => {
    await tx.stagingImport.update({
      where: { id: importId },
      data: { targetCount },
    });

    for (const [cardId, blockIndex] of assignments) {
      await tx.stagingCard.update({
        where: { id: cardId },
        data: { suggestedBlock: blockIndex },
      });
    }
  });
}

export async function getDefaultStagingTargetCount(): Promise<number> {
  const setting = await db.appSetting.findUnique({
    where: { key: "default_staging_target_count" },
  });
  const parsed = Number(setting?.value ?? 200);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
}
