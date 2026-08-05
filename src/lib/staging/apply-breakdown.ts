import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { assignSuggestedBlockIndices } from "@/lib/staging/breakdown";

const UPDATE_CHUNK = 500;

async function batchApplyAssignments(
  assignments: Map<string, { suggestedBlock: number; position: number }>,
): Promise<number> {
  const entries = [...assignments.entries()];
  if (entries.length === 0) return 0;

  const suggestedBlocks = new Set(
    entries.map(([, assignment]) => assignment.suggestedBlock),
  ).size;

  await db.$transaction(
    async (tx) => {
      for (let i = 0; i < entries.length; i += UPDATE_CHUNK) {
        const chunk = entries.slice(i, i + UPDATE_CHUNK);
        const tuples = chunk.map(
          ([id, assignment]) =>
            Prisma.sql`(${id}, ${assignment.suggestedBlock}, ${assignment.position})`,
        );

        await tx.$executeRaw`
          UPDATE "StagingCard" AS sc
          SET "suggestedBlock" = v.block, "position" = v.pos
          FROM (VALUES ${Prisma.join(tuples)}) AS v(id, block, pos)
          WHERE sc.id = v.id
        `;
      }
    },
    { timeout: 120_000 },
  );

  return suggestedBlocks;
}

export async function applyBreakdownToImport(
  importId: string,
  targetCount: number,
): Promise<number> {
  const cards = await db.stagingCard.findMany({
    where: { stagingImportId: importId },
    select: { id: true, sourceRow: true, expansionIndex: true },
  });

  const assignments = assignSuggestedBlockIndices(cards, targetCount);

  await db.stagingImport.update({
    where: { id: importId },
    data: { targetCount },
  });

  return batchApplyAssignments(assignments);
}

export async function getDefaultStagingTargetCount(): Promise<number> {
  const setting = await db.appSetting.findUnique({
    where: { key: "default_staging_target_count" },
    select: { value: true },
  });
  const parsed = Number(setting?.value ?? 50);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}
