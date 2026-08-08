export const SHORT_REASONS = [
  "NO_STOCK",
  "POSITION_MISMATCH",
  "BLOCK_QUARANTINED",
  "DAMAGED",
  "OTHER",
] as const;

export type ShortReason = (typeof SHORT_REASONS)[number];

export const SHORT_REASON_LABELS: Record<ShortReason, string> = {
  NO_STOCK: "No stock",
  POSITION_MISMATCH: "Position mismatch",
  BLOCK_QUARANTINED: "Block quarantined",
  DAMAGED: "Damaged card",
  OTHER: "Other",
};
