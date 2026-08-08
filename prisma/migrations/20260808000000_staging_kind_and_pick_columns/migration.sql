-- CreateEnum
CREATE TYPE "StagingImportKind" AS ENUM ('TRADE_IN', 'CORRECTION');

-- DropForeignKey
ALTER TABLE "PickHistory" DROP CONSTRAINT "PickHistory_blockId_fkey";

-- AlterTable
ALTER TABLE "PickHistory" ADD COLUMN     "blockTierAtPick" "BlockTier",
ADD COLUMN     "isCounterPick" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "blockId" DROP NOT NULL,
ALTER COLUMN "pickItemId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PickItem" ADD COLUMN     "blockedReason" TEXT;

-- AlterTable
ALTER TABLE "PickList" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sourceLabel" TEXT;

-- AlterTable
ALTER TABLE "StagingImport" ADD COLUMN     "kind" "StagingImportKind" NOT NULL DEFAULT 'TRADE_IN',
ADD COLUMN     "sourceMtgBlockId" TEXT,
ADD COLUMN     "sourceNotes" TEXT,
ADD COLUMN     "sourcePickListId" TEXT;

-- AddForeignKey
ALTER TABLE "PickHistory" ADD CONSTRAINT "PickHistory_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;
