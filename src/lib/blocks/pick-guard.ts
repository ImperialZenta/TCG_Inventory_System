import type { Prisma } from "@prisma/client";

export const BLOCK_HAS_PICK_HISTORY_MESSAGE =
  "Cannot remove a block that has pick history — complete or cancel picks first, or archive/liquidate the block.";

type TransactionClient = Prisma.TransactionClient;

/** Re-check pick items inside a transaction before block delete (B-010). */
export async function assertBlockHasNoPickItems(
  tx: TransactionClient,
  blockInternalId: string,
): Promise<void> {
  const block = await tx.block.findUnique({
    where: { id: blockInternalId },
    select: { _count: { select: { pickItems: true } } },
  });

  if (!block) {
    throw new Error("Block not found");
  }

  if (block._count.pickItems > 0) {
    throw new PickGuardError(BLOCK_HAS_PICK_HISTORY_MESSAGE);
  }
}

export class PickGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PickGuardError";
  }
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2003"
  );
}
