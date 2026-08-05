export type StagingLogLevel = "info" | "warn" | "error" | "success";

export interface StagingLogEntry {
  at: string;
  level: StagingLogLevel;
  message: string;
}

export interface StagingUploadSummary {
  filename: string;
  csvRows: number;
  units: number;
  suggestedBlocks: number;
  targetCount: number;
  parseWarnings: number;
}

export type StagingUploadResult =
  | {
      ok: true;
      importId: string;
      log: StagingLogEntry[];
      summary: StagingUploadSummary;
    }
  | { ok: false; log: StagingLogEntry[]; message: string };

export interface UploadLogger {
  entries: StagingLogEntry[];
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

export function createUploadLogger(): UploadLogger {
  const entries: StagingLogEntry[] = [];

  function push(level: StagingLogLevel, message: string) {
    entries.push({
      at: new Date().toISOString(),
      level,
      message,
    });
  }

  return {
    entries,
    info: (message) => push("info", message),
    warn: (message) => push("warn", message),
    error: (message) => push("error", message),
    success: (message) => push("success", message),
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
