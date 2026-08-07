import type { BlockStatus } from "@prisma/client";
import { BLOCK_HAS_PICK_HISTORY_MESSAGE } from "@/lib/blocks/pick-guard";

export const ACTIVE_BLOCK_REMOVE_MESSAGE =
  "Cannot remove an active block — take it offline first, then remove or liquidate after picks are drained.";

export const ACTIVE_BLOCK_REMOVE_REMEDIATION =
  "Use Take offline in the Lifecycle section above to stop new orders, then remove or liquidate when in-flight picks are complete.";

export const LIQUIDATED_BLOCK_REMOVE_MESSAGE =
  "Cannot remove a liquidated block — final state. Restore from backup if this was a mistake.";

export interface BlockRemovalEligibility {
  allowed: boolean;
  reason?: string;
  remediation?: string;
}

export function getBlockRemovalEligibility(block: {
  status: BlockStatus;
  pickItemCount: number;
}): BlockRemovalEligibility {
  if (block.pickItemCount > 0) {
    return {
      allowed: false,
      reason: BLOCK_HAS_PICK_HISTORY_MESSAGE,
    };
  }

  if (block.status === "ACTIVE") {
    return {
      allowed: false,
      reason: ACTIVE_BLOCK_REMOVE_MESSAGE,
      remediation: ACTIVE_BLOCK_REMOVE_REMEDIATION,
    };
  }

  if (block.status === "LIQUIDATED") {
    return {
      allowed: false,
      reason: LIQUIDATED_BLOCK_REMOVE_MESSAGE,
    };
  }

  return { allowed: true };
}
