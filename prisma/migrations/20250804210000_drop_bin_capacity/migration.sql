-- DropBinCapacity: bins accept unlimited blocks; track used count only
ALTER TABLE "Bin" DROP COLUMN "capacity";
