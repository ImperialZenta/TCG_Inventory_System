-- CreateEnum
CREATE TYPE "UploadSessionStatus" AS ENUM ('DRAFT', 'CSV_READY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "UploadSessionSequence" (
    "id" TEXT NOT NULL DEFAULT 'upload',
    "nextNum" INTEGER NOT NULL DEFAULT 1,
    "prefix" TEXT NOT NULL DEFAULT 'UP',

    CONSTRAINT "UploadSessionSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "channel" "BlockChannel" NOT NULL,
    "status" "UploadSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "csvGeneratedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSessionBlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadSessionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadExportAudit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "blockIds" TEXT[],
    "filename" TEXT NOT NULL,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadExportAudit_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Block" ADD COLUMN "reservedUploadSessionId" TEXT;

-- AlterTable
ALTER TABLE "InventoryEvent" ADD COLUMN "uploadSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UploadSession_sessionId_key" ON "UploadSession"("sessionId");

-- CreateIndex
CREATE INDEX "UploadSession_status_idx" ON "UploadSession"("status");

-- CreateIndex
CREATE INDEX "UploadSession_createdAt_idx" ON "UploadSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadSessionBlock_sessionId_blockId_key" ON "UploadSessionBlock"("sessionId", "blockId");

-- CreateIndex
CREATE INDEX "UploadSessionBlock_blockId_idx" ON "UploadSessionBlock"("blockId");

-- CreateIndex
CREATE INDEX "UploadExportAudit_sessionId_idx" ON "UploadExportAudit"("sessionId");

-- CreateIndex
CREATE INDEX "Block_reservedUploadSessionId_idx" ON "Block"("reservedUploadSessionId");

-- CreateIndex
CREATE INDEX "InventoryEvent_uploadSessionId_idx" ON "InventoryEvent"("uploadSessionId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_reservedUploadSessionId_fkey" FOREIGN KEY ("reservedUploadSessionId") REFERENCES "UploadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSessionBlock" ADD CONSTRAINT "UploadSessionBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSessionBlock" ADD CONSTRAINT "UploadSessionBlock_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadExportAudit" ADD CONSTRAINT "UploadExportAudit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "UploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_uploadSessionId_fkey" FOREIGN KEY ("uploadSessionId") REFERENCES "UploadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed sequence row
INSERT INTO "UploadSessionSequence" ("id", "nextNum", "prefix") VALUES ('upload', 1, 'UP');
