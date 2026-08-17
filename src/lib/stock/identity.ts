import type { Condition, Finish } from "@prisma/client";
import { printingKey } from "@/lib/inventory/card-identity";

export interface StockIdentity {
  gameId?: string;
  catalogCardId?: string | null;
  scryfallId?: string | null;
  name: string;
  setCode: string;
  collectorNumber?: string | null;
  finish: Finish;
  language?: string;
  condition: Condition;
}

export interface NormalizedStockIdentity {
  gameId: string;
  catalogCardId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  finish: Finish;
  language: string;
  condition: Condition;
}

export function resolveCatalogCardId(identity: StockIdentity): string {
  if (identity.catalogCardId) {
    return identity.catalogCardId;
  }
  if (identity.scryfallId) {
    return identity.scryfallId;
  }
  return printingKey({
    scryfallId: null,
    name: identity.name,
    setCode: identity.setCode,
    collectorNumber: identity.collectorNumber ?? null,
  });
}

export function normalizeStockIdentity(identity: StockIdentity): NormalizedStockIdentity {
  return {
    gameId: identity.gameId ?? "mtg",
    catalogCardId: resolveCatalogCardId(identity),
    name: identity.name,
    setCode: identity.setCode.toLowerCase(),
    collectorNumber: identity.collectorNumber ?? "",
    finish: identity.finish,
    language: identity.language ?? "en",
    condition: identity.condition,
  };
}

export function stockIdentityUniqueWhere(identity: NormalizedStockIdentity) {
  return {
    gameId_catalogCardId_setCode_collectorNumber_finish_language_condition: {
      gameId: identity.gameId,
      catalogCardId: identity.catalogCardId,
      setCode: identity.setCode,
      collectorNumber: identity.collectorNumber,
      finish: identity.finish,
      language: identity.language,
      condition: identity.condition,
    },
  };
}
