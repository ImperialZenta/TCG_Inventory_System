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

/** Human label for quarantine / pick-hold reasons shown in the UI. */
export function formatPickHoldReason(reason: string | null | undefined): string {
  if (!reason) return "Quarantined";
  if (reason === "Quarantined for picking" || reason === "Needs repair") {
    return "Quarantined";
  }
  if (reason in SHORT_REASON_LABELS) {
    return SHORT_REASON_LABELS[reason as ShortReason];
  }
  // Hold banners may embed a code, e.g. "Block MTG-0005 quarantined: POSITION_MISMATCH (...)"
  let formatted = reason;
  for (const [code, label] of Object.entries(SHORT_REASON_LABELS)) {
    formatted = formatted.replaceAll(code, label);
  }
  return formatted;
}
