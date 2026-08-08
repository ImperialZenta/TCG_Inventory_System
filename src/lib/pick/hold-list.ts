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

function formatBlockedLines(
  items: {
    blockedReason: string | null;
    cardLine: { position: number; name: string } | null;
    externalOrderLine: { name: string } | null;
    block: { blockId: string; pickHoldAt: Date | null } | null;
  }[],
): string[] {
  return items
    .filter((item) => item.block?.pickHoldAt || item.blockedReason)
    .map((item) => {
      const name = item.externalOrderLine?.name ?? item.cardLine?.name ?? "unknown";
      const pos = item.cardLine?.position;
      const blockId = item.block?.blockId ?? "unknown block";
      const reason =
        item.blockedReason ?? (item.block?.pickHoldAt ? "quarantined" : "blocked");
      const posLabel = pos != null ? `pos ${pos} ` : "";
      return `${blockId} ${posLabel}${name} (${reason})`;
    });
}

export async function resumePickList(pickListId: string, _ctx: DomainContext): Promise<void> {
  const pickList = await db.pickList.findUnique({
    where: { id: pickListId },
    include: {
      items: {
        where: { status: "PENDING" },
        include: {
          block: true,
          cardLine: { select: { position: true, name: true } },
          externalOrderLine: { select: { name: true } },
        },
      },
    },
  });

  if (!pickList) {
    throw new PickError("Pick list not found");
  }

  if (pickList.status !== "ON_HOLD") {
    throw new PickError("Pick list is not on hold");
  }

  const blockedLines = formatBlockedLines(pickList.items);
  if (blockedLines.length > 0) {
    throw new PickError(
      `Cannot resume while lines are blocked by quarantine:\n${blockedLines.join("\n")}`,
    );
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

  const blockedOnQuarantine = pickList.items.some(
    (item) => item.block?.pickHoldAt || item.blockedReason,
  );
  if (blockedOnQuarantine) {
    return false;
  }

  await resumePickList(pickListId, ctx);
  return true;
}
