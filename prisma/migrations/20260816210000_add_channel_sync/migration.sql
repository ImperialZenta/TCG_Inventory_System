-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('MANAPOOL', 'SHOPIFY', 'EBAY', 'TCGPLAYER');

-- CreateEnum
CREATE TYPE "ChannelSyncMode" AS ENUM ('MANUAL_CSV', 'ONE_WAY_PUSH', 'TWO_WAY');

-- CreateEnum
CREATE TYPE "ChannelListingStatus" AS ENUM ('ACTIVE', 'DELISTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ChannelOutboxOperation" AS ENUM ('UPSERT_LISTING', 'UPDATE_QTY', 'UPDATE_PRICE', 'DELIST');

-- CreateEnum
CREATE TYPE "ChannelOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "OversellIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "OversellResolution" AS ENUM ('FULFILLED_ALT', 'PROMOTED', 'CANCELLED_REFUND');

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "syncMode" "ChannelSyncMode" NOT NULL DEFAULT 'ONE_WAY_PUSH',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "reserveBufferQty" INTEGER NOT NULL DEFAULT 0,
    "credentials" JSONB,
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelListing" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "externalListingId" TEXT,
    "lastSyncedQty" INTEGER,
    "lastSyncedAt" TIMESTAMP(3),
    "status" "ChannelListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelOutbox" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "operation" "ChannelOutboxOperation" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChannelOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OversellIncident" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "status" "OversellIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" "OversellResolution",
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OversellIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OversellIncidentOrder" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "channelOrderRef" TEXT NOT NULL,

    CONSTRAINT "OversellIncidentOrder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ExternalOrder" ADD COLUMN "channelId" TEXT;

-- AlterTable
ALTER TABLE "ExternalOrderLine" ADD COLUMN "stockItemId" TEXT,
ADD COLUMN "unmatched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "oversellFlag" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Channel_type_idx" ON "Channel"("type");

-- CreateIndex
CREATE INDEX "Channel_enabled_paused_idx" ON "Channel"("enabled", "paused");

-- CreateIndex
CREATE INDEX "ChannelListing_stockItemId_idx" ON "ChannelListing"("stockItemId");

-- CreateIndex
CREATE INDEX "ChannelListing_status_idx" ON "ChannelListing"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelListing_channelId_stockItemId_key" ON "ChannelListing"("channelId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelOutbox_idempotencyKey_key" ON "ChannelOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ChannelOutbox_status_createdAt_idx" ON "ChannelOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelOutbox_channelId_idx" ON "ChannelOutbox"("channelId");

-- CreateIndex
CREATE INDEX "OversellIncident_status_idx" ON "OversellIncident"("status");

-- CreateIndex
CREATE INDEX "OversellIncident_stockItemId_idx" ON "OversellIncident"("stockItemId");

-- CreateIndex
CREATE INDEX "OversellIncident_createdAt_idx" ON "OversellIncident"("createdAt");

-- CreateIndex
CREATE INDEX "OversellIncidentOrder_incidentId_idx" ON "OversellIncidentOrder"("incidentId");

-- CreateIndex
CREATE INDEX "OversellIncidentOrder_channelId_idx" ON "OversellIncidentOrder"("channelId");

-- CreateIndex
CREATE INDEX "ExternalOrder_channelId_idx" ON "ExternalOrder"("channelId");

-- CreateIndex
CREATE INDEX "ExternalOrderLine_stockItemId_idx" ON "ExternalOrderLine"("stockItemId");

-- AddForeignKey
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrderLine" ADD CONSTRAINT "ExternalOrderLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelListing" ADD CONSTRAINT "ChannelListing_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelOutbox" ADD CONSTRAINT "ChannelOutbox_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OversellIncident" ADD CONSTRAINT "OversellIncident_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OversellIncidentOrder" ADD CONSTRAINT "OversellIncidentOrder_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OversellIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OversellIncidentOrder" ADD CONSTRAINT "OversellIncidentOrder_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OversellIncidentOrder" ADD CONSTRAINT "OversellIncidentOrder_externalOrderId_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
