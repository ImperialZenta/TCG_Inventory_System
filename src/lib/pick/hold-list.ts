import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { PickError } from "@/lib/pick/errors";

type TransactionClient = Prisma.TransactionClient;

export async function holdPickList(
  pickListId: string,
  reason: string,
  ctx: DomainContext,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await holdPickListInTx(tx, pickListId, reason, ctx);
  });
}

export async function holdPickListInTx(
  tx: TransactionClient,
  pickListId: string,
  reason: string,
  _ctx: DomainContext,
): Promise<void> {
  const pickList = await tx.pickList.findUnique({ where: { id: pickListId } });
  if (!pickList) {
    throw new PickError("Pick list not found");
  }

  if (pickList.status === "COMPLETED" || pickList.status === "CANCELLED") {
    throw new PickError(`Cannot hold a ${pickList.status.toLowerCase()} list`);
  }

  if (pickList.status === "ON_HOLD") {
    return;
  }

  await tx.pickList.update({
    where: { id: pickListId },
    data: {
      status: "ON_HOLD",
      holdReason: reason.trim() || "On hold",
    },
  });
}

export async function resumePickList(pickListId: string, ctx: DomainContext): Promise<void> {
  const pickList = await db.pickList.findUnique({
    where: { id: pickListId },
    include: { items: { where: { status: "PENDING" } } },
  });

  if (!pickList) {
    throw new PickError("Pick list not found");
  }

  if (pickList.status !== "ON_HOLD") {
    throw new PickError("Pick list is not on hold");
  }

  const hasPending = pickList.items.length > 0;
  await db.pickList.update({
    where: { id: pickListId },
    data: {
      status: hasPending ? "IN_PROGRESS" : "OPEN",
      holdReason: null,
    },
  });
}

export async function tryAutoReleaseHold(
  pickListId: string,
  ctx: DomainContext,
): Promise<boolean> {
  const pickList = await db.pickList.findUnique({
    where: { id: pickListId },
    include: {
      items: {
        where: { status: "PENDING" },
        include: { block: true },
      },
    },
  });

  if (!pickList || pickList.status !== "ON_HOLD") {
    return false;
  }

  const blockedOnQuarantine = pickList.items.some((item) => item.block?.pickHoldAt);
  if (blockedOnQuarantine) {
    return false;
  }

  await resumePickList(pickListId, ctx);
  return true;
}
