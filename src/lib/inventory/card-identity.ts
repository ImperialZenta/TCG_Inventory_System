import type { CardLine, Condition, Finish } from "@prisma/client";

/** Shared card identity for search, quantity, and pick allocation. */
export interface CardIdentity {
  scryfallId?: string | null;
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition?: Condition;
  finish?: Finish;
  language?: string;
}

export type OrderLineIdentity = CardIdentity & {
  condition: Condition;
  finish: Finish;
  language: string;
};

export function printingKey(line: Pick<CardLine, "scryfallId" | "name" | "setCode" | "collectorNumber">): string {
  if (line.scryfallId) return line.scryfallId;
  return `${line.name.toLowerCase()}|${line.setCode.toLowerCase()}|${line.collectorNumber ?? ""}`;
}

export function cardLineMatchesIdentity(
  line: CardLine,
  identity: CardIdentity,
  options?: { requireQuantity?: boolean },
): boolean {
  const requireQuantity = options?.requireQuantity ?? true;
  if (requireQuantity && line.quantity <= 0) return false;

  if (identity.condition && line.condition !== identity.condition) return false;
  if (identity.finish && line.finish !== identity.finish) return false;
  if (identity.language && line.language !== identity.language) return false;

  if (identity.scryfallId) {
    return line.scryfallId === identity.scryfallId;
  }

  if (line.name.toLowerCase() !== identity.name.toLowerCase()) {
    return false;
  }

  if (identity.setCode && line.setCode.toLowerCase() !== identity.setCode.toLowerCase()) {
    return false;
  }

  if (
    identity.collectorNumber &&
    (line.collectorNumber ?? "").toLowerCase() !== identity.collectorNumber.toLowerCase()
  ) {
    return false;
  }

  return true;
}

export function buildCardLineWhere(identity: CardIdentity) {
  if (identity.scryfallId) {
    return { scryfallId: identity.scryfallId };
  }

  return {
    name: { equals: identity.name, mode: "insensitive" as const },
    ...(identity.setCode
      ? { setCode: { equals: identity.setCode, mode: "insensitive" as const } }
      : {}),
    ...(identity.collectorNumber
      ? { collectorNumber: { equals: identity.collectorNumber, mode: "insensitive" as const } }
      : {}),
  };
}
