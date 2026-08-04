export const BACKUP_VERSION = "0.1.0";

export interface BackupLanguage {
  scryfallCode: string;
  manapoolCode: string | null;
  label: string;
  localOnly: boolean;
}

export interface BackupSetting {
  key: string;
  value: string;
}

export interface BackupShelf {
  id: string;
  code: string;
  label: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  bins?: unknown[];
}

export interface BackupBin {
  id: string;
  binId: string;
  shelfId: string | null;
  capacity: number;
  label: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupCardLine {
  id: string;
  blockId: string;
  scryfallId: string | null;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  finish: string;
  language: string;
  condition: string;
  quantity: number;
  isBulkLine: boolean;
  bulkDescription: string | null;
  priceUsd: number | null;
  imageUri: string | null;
  addedAt: string;
}

export interface BackupBlock {
  id: string;
  blockId: string;
  label: string | null;
  status: string;
  tier: string;
  channel: string;
  binId: string | null;
  packedAt: string;
  sealedAt: string | null;
  lastPickAt: string | null;
  activatedAt: string | null;
  targetCount: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cards: BackupCardLine[];
}

export interface BackupStagingCard {
  id: string;
  stagingImportId: string;
  scryfallId: string | null;
  name: string;
  setCode: string;
  collectorNumber: string | null;
  finish: string;
  language: string;
  condition: string;
  quantity: number;
  suggestedBlock: number | null;
  assignedBlockId: string | null;
  sourceRow: number | null;
  createdAt: string;
}

export interface BackupStagingImport {
  id: string;
  filename: string;
  rowCount: number;
  status: string;
  targetCount: number | null;
  createdAt: string;
  cards: BackupStagingCard[];
}

export interface InventoryBackup {
  exportedAt: string;
  version: string;
  shelves: BackupShelf[];
  bins: BackupBin[];
  blocks: BackupBlock[];
  languages: BackupLanguage[];
  settings: BackupSetting[];
  stagingImports: BackupStagingImport[];
}

export interface BackupSummary {
  exportedAt: string;
  version: string;
  shelfCount: number;
  binCount: number;
  blockCount: number;
  cardLineCount: number;
  stagingImportCount: number;
}
