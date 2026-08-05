-- Position-indexed chaos blocks: one physical card per row with slot number.

-- StagingCard
ALTER TABLE "StagingCard" ADD COLUMN IF NOT EXISTS "position" INTEGER;
ALTER TABLE "StagingCard" ADD COLUMN IF NOT EXISTS "expansionIndex" INTEGER;

CREATE INDEX IF NOT EXISTS "StagingCard_stagingImportId_suggestedBlock_position_idx"
  ON "StagingCard"("stagingImportId", "suggestedBlock", "position");

-- CardLine
ALTER TABLE "CardLine" ADD COLUMN IF NOT EXISTS "position" INTEGER;

UPDATE "CardLine" AS c
SET "position" = numbered.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "blockId" ORDER BY "addedAt", id) AS rn
  FROM "CardLine"
  WHERE "position" IS NULL
) AS numbered
WHERE c.id = numbered.id AND c."position" IS NULL;

ALTER TABLE "CardLine" ALTER COLUMN "position" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CardLine_blockId_position_key"
  ON "CardLine"("blockId", "position");
