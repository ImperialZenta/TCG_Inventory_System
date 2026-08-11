import type { Block, BlockStatus } from "@prisma/client";
import { BLOCK_STATUS_LABELS } from "@/lib/constants";
import { UploadSessionError } from "@/lib/upload-sessions/errors";

const OPEN_SESSION_STATUSES = ["DRAFT", "CSV_READY"] as const;

export { OPEN_SESSION_STATUSES };

export type BlockForSessionEligibility = Pick<
  Block,
  "id" | "blockId" | "status" | "pickHoldAt" | "reservedUploadSessionId"
>;

export function assertBlockEligibleForUploadSession(
  block: BlockForSessionEligibility,
  options?: { reservedSessionDisplayId?: string },
): void {
  if (block.status !== "SEALED") {
    if (block.status === "ACTIVE") {
      throw new UploadSessionError(
        `${block.blockId} is already active — active blocks cannot join an upload session`,
      );
    }
    const label = BLOCK_STATUS_LABELS[block.status] ?? block.status;
    throw new UploadSessionError(
      `${block.blockId} cannot join an upload session — block is ${label.toLowerCase()}`,
    );
  }

  if (block.pickHoldAt) {
    throw new UploadSessionError(
      `${block.blockId} is quarantined and cannot join an upload session`,
    );
  }

  if (block.reservedUploadSessionId) {
    const sessionRef = options?.reservedSessionDisplayId
      ? ` in ${options.reservedSessionDisplayId}`
      : "";
    throw new UploadSessionError(
      `${block.blockId} is already reserved${sessionRef}`,
    );
  }
}

/** Re-validate blocks already in an open session (reserved to this session is expected). */
export function assertBlockValidInOpenSession(
  block: BlockForSessionEligibility,
  sessionInternalId: string,
  sessionDisplayId: string,
): void {
  if (block.status !== "SEALED") {
    throw new UploadSessionError(
      `${block.blockId} is no longer sealed — remove it from ${sessionDisplayId} or cancel the session`,
    );
  }

  if (block.pickHoldAt) {
    throw new UploadSessionError(
      `${block.blockId} is quarantined and cannot remain in ${sessionDisplayId}`,
    );
  }

  if (block.reservedUploadSessionId !== sessionInternalId) {
    throw new UploadSessionError(
      `${block.blockId} is no longer reserved for ${sessionDisplayId}`,
    );
  }
}

export function formatBlockStatusLabel(status: BlockStatus): string {
  return BLOCK_STATUS_LABELS[status] ?? status;
}
