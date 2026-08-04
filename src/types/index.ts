export type BlockStatus = "OPEN" | "SEALED" | "ACTIVE" | "ARCHIVED" | "LIQUIDATED";
export type BlockTier =
  | "GENERAL"
  | "BULK_COMMONS"
  | "TRADE_IN"
  | "MYSTERY_ELIGIBLE"
  | "HIGH_VALUE_HOLD";
export type Condition = "NM" | "LP" | "MP" | "HP" | "DMG";
export type Finish = "NONFOIL" | "FOIL" | "ETCHED";
export type PickStatus = "PENDING" | "PICKED" | "SHORT" | "SUBSTITUTED";

export interface BlockSummary {
  id: string;
  blockId: string;
  label: string | null;
  status: BlockStatus;
  tier: BlockTier;
  locationCode: string | null;
  cardCount: number;
  estimatedValue: number;
  packedAt: string;
  lastPickAt: string | null;
  daysSinceLastPick: number | null;
}

export interface AgingBucket {
  label: string;
  count: number;
}
