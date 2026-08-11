import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export function formatUploadSessionId(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(4, "0")}`;
}

export async function allocateNextUploadSessionId(
  tx: TransactionClient,
): Promise<string> {
  const seq = await tx.uploadSessionSequence.upsert({
    where: { id: "upload" },
    update: { nextNum: { increment: 1 } },
    create: { id: "upload", nextNum: 2, prefix: "UP" },
  });

  return formatUploadSessionId(seq.prefix, seq.nextNum - 1);
}
