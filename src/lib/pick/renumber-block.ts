import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

const RENUMBER_OFFSET = 100_000;

/**
 * Delete a card line and compact positions in one transaction.
 * Uses two-phase offset to satisfy @@unique([blockId, position]).
 */
export async function deleteCardLineAndRenumber(
  tx: TransactionClient,
  blockId: string,
  cardLineId: string,
  pickedPosition: number,
): Promise<void> {
  await tx.cardLine.updateMany({
    where: { blockId },
    data: { position: { increment: RENUMBER_OFFSET } },
  });

  await tx.cardLine.delete({ where: { id: cardLineId } });

  const offsetPosition = pickedPosition + RENUMBER_OFFSET;
  await tx.$executeRaw`
    UPDATE "CardLine"
    SET position = position - ${RENUMBER_OFFSET + 1}
    WHERE "blockId" = ${blockId}
      AND position > ${offsetPosition}
  `;
}
