import { BACKUP_VERSION } from "@/lib/backup-types";
import { db } from "@/lib/db";

export async function exportInventoryBackup() {
  const [shelves, bins, blocks, languages, settings, stagingImports] = await Promise.all([
    db.shelf.findMany({ include: { bins: true } }),
    db.bin.findMany(),
    db.block.findMany({ include: { cards: true } }),
    db.language.findMany(),
    db.appSetting.findMany(),
    db.stagingImport.findMany({ include: { cards: true } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
    shelves,
    bins,
    blocks,
    languages,
    settings,
    stagingImports,
  };
}
