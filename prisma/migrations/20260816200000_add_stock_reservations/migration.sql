-- CreateEnum
CREATE TYPE "StockReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'COMMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StockReservationReleaseReason" AS ENUM ('CANCEL', 'EXPIRED', 'COMMITTED');

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "status" "StockReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "releaseReason" "StockReservationReleaseReason",
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockReservation_expiresAt_status_idx" ON "StockReservation"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_referenceType_referenceId_stockItemId_key" ON "StockReservation"("referenceType", "referenceId", "stockItemId");

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
