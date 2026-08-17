-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('RECEIVE', 'PROMOTE', 'SALE', 'RETURN', 'COUNT_ADJUST', 'TRANSFER', 'RESERVE', 'RELEASE', 'DAMAGE');

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL DEFAULT 'mtg',
    "catalogCardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "collectorNumber" TEXT NOT NULL DEFAULT '',
    "finish" "Finish" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "condition" "Condition" NOT NULL,
    "onHandQuantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "costBasisCents" INTEGER,
    "marketPriceCents" INTEGER,
    "catalogImageUri" TEXT,
    "binId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "InventoryEvent" ADD COLUMN "stockItemId" TEXT;

-- CreateIndex
CREATE INDEX "StockItem_name_idx" ON "StockItem"("name");

-- CreateIndex
CREATE INDEX "StockItem_setCode_idx" ON "StockItem"("setCode");

-- CreateIndex
CREATE INDEX "StockItem_catalogCardId_idx" ON "StockItem"("catalogCardId");

-- CreateIndex
CREATE INDEX "StockItem_binId_idx" ON "StockItem"("binId");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_gameId_catalogCardId_setCode_collectorNumber_finish_language_condition_key" ON "StockItem"("gameId", "catalogCardId", "setCode", "collectorNumber", "finish", "language", "condition");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryEvent_stockItemId_idx" ON "InventoryEvent"("stockItemId");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
