export const STALE_BLOCK_DAYS = Number(process.env.STALE_BLOCK_DAYS ?? 90);

export const AGING_BUCKETS = [
  { label: "0–30 days", min: 0, max: 30 },
  { label: "31–60 days", min: 31, max: 60 },
  { label: "61–90 days", min: 61, max: 90 },
  { label: "90+ days", min: 91, max: Infinity },
] as const;

export const BLOCK_STATUS_LABELS: Record<string, string> = {
  OPEN: "Unsealed",
  SEALED: "Sealed",
  ACTIVE: "Active",
  ARCHIVED: "Archived",
  LIQUIDATED: "Liquidated",
};

export const BLOCK_TIER_LABELS: Record<string, string> = {
  GENERAL: "General",
  BULK_COMMONS: "Bulk Commons",
  TRADE_IN: "Trade-In",
  MYSTERY_ELIGIBLE: "Mystery Eligible",
  HIGH_VALUE_HOLD: "High Value Hold",
};

export const BLOCK_CHANNEL_LABELS: Record<string, string> = {
  MANAPOOL: "Mana Pool",
  EBAY: "eBay",
  TCGPLAYER: "TCGplayer",
};

export const FINISH_LABELS: Record<string, string> = {
  NONFOIL: "Non-Foil",
  FOIL: "Foil",
  ETCHED: "Etched",
};

export const CONDITION_LABELS: Record<string, string> = {
  NM: "Near Mint",
  LP: "Lightly Played",
  MP: "Moderately Played",
  HP: "Heavily Played",
  DMG: "Damaged",
};

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/staging", label: "Staging" },
  { href: "/blocks", label: "Blocks" },
  { href: "/orders", label: "Orders" },
  { href: "/pick", label: "Pick Lists" },
  { href: "/inventory", label: "Inventory" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
] as const;
