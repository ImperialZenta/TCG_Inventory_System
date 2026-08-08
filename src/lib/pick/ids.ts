import { db } from "@/lib/db";

export async function allocateNextPickListId(): Promise<string> {
  const seq = await db.pickListSequence.update({
    where: { id: "pick" },
    data: { nextNum: { increment: 1 } },
  });

  const num = seq.nextNum - 1;
  const prefix = seq.prefix ?? "PICK";
  return `${prefix}-${String(num).padStart(4, "0")}`;
}
