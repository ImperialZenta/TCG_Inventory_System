import { BACKUP_VERSION, type BackupSummary, type InventoryBackup } from "@/lib/backup-types";

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new BackupValidationError(`Invalid backup: "${field}" must be an array`);
  }
  return value;
}

function normalizeBin(raw: Record<string, unknown>): InventoryBackup["bins"][number] {
  const bin = raw as unknown as InventoryBackup["bins"][number] & { capacity?: number };
  return {
    id: bin.id,
    binId: bin.binId,
    shelfId: bin.shelfId,
    label: bin.label,
    sortOrder: bin.sortOrder,
    createdAt: bin.createdAt,
    updatedAt: bin.updatedAt,
  };
}

export function parseBackupJson(raw: string): InventoryBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupValidationError("Invalid backup: file is not valid JSON");
  }

  if (!isRecord(parsed)) {
    throw new BackupValidationError("Invalid backup: root must be a JSON object");
  }

  if (typeof parsed.version !== "string") {
    throw new BackupValidationError('Invalid backup: missing "version"');
  }

  if (parsed.version !== BACKUP_VERSION) {
    throw new BackupValidationError(
      `Unsupported backup version "${parsed.version}" (expected ${BACKUP_VERSION})`,
    );
  }

  const rawBlocks = requireArray(parsed.blocks, "blocks") as Record<string, unknown>[];
  const rawStagingImports = requireArray(parsed.stagingImports, "stagingImports") as Record<
    string,
    unknown
  >[];

  return {
    exportedAt: String(parsed.exportedAt ?? ""),
    version: parsed.version,
    shelves: requireArray(parsed.shelves, "shelves") as InventoryBackup["shelves"],
    bins: (requireArray(parsed.bins, "bins") as Record<string, unknown>[]).map(normalizeBin),
    blocks: rawBlocks.map((block) => ({
      ...(block as Omit<InventoryBackup["blocks"][number], "cards">),
      cards: Array.isArray(block.cards)
        ? (block.cards as InventoryBackup["blocks"][number]["cards"])
        : [],
    })),
    languages: requireArray(parsed.languages, "languages") as InventoryBackup["languages"],
    settings: requireArray(parsed.settings, "settings") as InventoryBackup["settings"],
    stagingImports: rawStagingImports.map((stagingImport) => ({
      ...(stagingImport as Omit<InventoryBackup["stagingImports"][number], "cards">),
      cards: Array.isArray(stagingImport.cards)
        ? (stagingImport.cards as InventoryBackup["stagingImports"][number]["cards"])
        : [],
    })),
  };
}

export function summarizeBackup(backup: InventoryBackup): BackupSummary {
  const cardLineCount = backup.blocks.reduce((sum, block) => sum + block.cards.length, 0);

  return {
    exportedAt: backup.exportedAt,
    version: backup.version,
    shelfCount: backup.shelves.length,
    binCount: backup.bins.length,
    blockCount: backup.blocks.length,
    cardLineCount,
    stagingImportCount: backup.stagingImports.length,
  };
}
