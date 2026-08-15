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

export const LIFECYCLE_TRANSITION_LABELS: Record<
  "ACTIVATE" | "ARCHIVE" | "LIQUIDATE",
  { button: string; pending: string; description: string }
> = {
  ACTIVATE: {
    button: "Mark as listed",
    pending: "Activating…",
    description:
      "Set status to Active after importing the Mana Pool CSV. Records activation date.",
  },
  ARCHIVE: {
    button: "Take offline",
    pending: "Archiving…",
    description: "Archive this block in the app. Active Mana Pool blocks require a manual marketplace delist checklist.",
  },
  LIQUIDATE: {
    button: "Mark as liquidated",
    pending: "Liquidating…",
    description:
      "Final disposition — sold through, sorted out, or otherwise removed from active inventory.",
  },
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

/** Staff-facing labels for StagingImport.status (PARSED, ASSIGNED, …). */
export const STAGING_IMPORT_STATUS_LABELS: Record<string, string> = {
  PARSED: "Awaiting formalize",
  ASSIGNED: "Formalized",
  ARCHIVED: "Archived",
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  IMPORTED: "Imported",
  PICKING: "Picking",
  PICKED: "Picked",
  CANCELLED: "Cancelled",
};

export const PICK_LIST_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PICK_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PICKED: "Picked",
  SHORT: "Short",
  SUBSTITUTED: "Substituted",
};

export const UPLOAD_SESSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  CSV_READY: "CSV ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/staging", label: "Staging" },
  { href: "/blocks", label: "Blocks" },
  { href: "/uploads", label: "Uploads" },
  { href: "/catalogs", label: "Catalogs" },
  { href: "/orders", label: "Orders" },
  { href: "/pick", label: "Pick Lists" },
  { href: "/inventory", label: "Inventory" },
  { href: "/analytics", label: "Analytics" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
] as const;

const READ_ONLY_HIDDEN_HREFS = new Set(["/staging", "/orders", "/pick", "/uploads", "/settings"]);
const CATALOG_CONFIGURE_ROLES = new Set(["OWNER", "MANAGER"]);

export function navItemsForRole(role: import("@prisma/client").MembershipRole | null) {
  return NAV_ITEMS.filter((item) => {
    if (role === "READ_ONLY" && READ_ONLY_HIDDEN_HREFS.has(item.href)) {
      return false;
    }
    if (item.href === "/catalogs" && (!role || !CATALOG_CONFIGURE_ROLES.has(role))) {
      return false;
    }
    return true;
  });
}
