import type { BlockChannel, Condition, Finish } from "@prisma/client";

export interface ImportedOrderLineDTO {
  manapoolLineId?: string;
  scryfallId?: string;
  name: string;
  setCode?: string;
  collectorNumber?: string;
  condition: Condition;
  finish: Finish;
  language: string;
  quantity: number;
  priceCents?: number;
}

export interface ImportedOrderDTO {
  manapoolOrderId: string;
  reference?: string;
  lines: ImportedOrderLineDTO[];
}

export interface OrderImportResult {
  externalOrderId: string;
  manapoolOrderId: string;
  lineCount: number;
  created: boolean;
}

export interface BatchImportSummary {
  imported: number;
  skipped: number;
  errors: string[];
}
