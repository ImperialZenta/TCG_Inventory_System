-- V-005: migrate CardLine.priceUsd (float) to priceCents (int); add staging price/image columns

-- CardLine: add priceCents, backfill from priceUsd, drop priceUsd
ALTER TABLE "CardLine" ADD COLUMN "priceCents" INTEGER;

UPDATE "CardLine"
SET "priceCents" = ROUND("priceUsd" * 100)
WHERE "priceUsd" IS NOT NULL;

ALTER TABLE "CardLine" DROP COLUMN "priceUsd";

-- StagingCard: persist intake-time price and image for formalize pass-through
ALTER TABLE "StagingCard" ADD COLUMN "priceCents" INTEGER,
ADD COLUMN "imageUri" TEXT;
