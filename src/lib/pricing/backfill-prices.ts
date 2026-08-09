import type { Finish } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { db } from "@/lib/db";
import {
  getCardImageUri,
  getCardPriceCents,
  getScryfallCardById,
  getScryfallCardBySetAndNumber,
  type ScryfallCard,
} from "@/lib/scryfall";

const SCRYFALL_DELAY_MS = 75;

export interface BackfillUnresolved {
  cardLineId: string;
  name: string;
  reason: string;
}

export interface BackfillResult {
  updated: number;
  unresolved: BackfillUnresolved[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveScryfallCard(line: {
  scryfallId: string | null;
  setCode: string;
  collectorNumber: string | null;
}): Promise<ScryfallCard | null> {
  if (line.scryfallId) {
    return getScryfallCardById(line.scryfallId);
  }

  if (line.setCode && line.collectorNumber) {
    return getScryfallCardBySetAndNumber(line.setCode, line.collectorNumber);
  }

  return null;
}

export async function backfillCardLinePrices(_ctx: DomainContext): Promise<BackfillResult> {
  void _ctx;

  const lines = await db.cardLine.findMany({
    where: { priceCents: null },
    select: {
      id: true,
      name: true,
      scryfallId: true,
      setCode: true,
      collectorNumber: true,
      finish: true,
    },
  });

  const result: BackfillResult = {
    updated: 0,
    unresolved: [],
  };

  for (const line of lines) {
    if (!line.scryfallId && !(line.setCode && line.collectorNumber)) {
      result.unresolved.push({
        cardLineId: line.id,
        name: line.name,
        reason: "No Scryfall ID or set/collector number",
      });
      continue;
    }

    try {
      const card = await resolveScryfallCard(line);
      if (!card) {
        result.unresolved.push({
          cardLineId: line.id,
          name: line.name,
          reason: "Card not found in Scryfall",
        });
        await sleep(SCRYFALL_DELAY_MS);
        continue;
      }

      const priceCents = getCardPriceCents(card, line.finish as Finish);
      const imageUri = getCardImageUri(card) ?? null;

      if (priceCents == null && imageUri == null) {
        result.unresolved.push({
          cardLineId: line.id,
          name: line.name,
          reason: "Scryfall returned no price or image",
        });
        await sleep(SCRYFALL_DELAY_MS);
        continue;
      }

      await db.cardLine.update({
        where: { id: line.id },
        data: {
          ...(priceCents != null ? { priceCents } : {}),
          ...(imageUri != null ? { imageUri } : {}),
        },
      });

      if (priceCents != null) {
        result.updated++;
      } else {
        result.unresolved.push({
          cardLineId: line.id,
          name: line.name,
          reason: "Scryfall returned no price",
        });
      }
    } catch (error) {
      result.unresolved.push({
        cardLineId: line.id,
        name: line.name,
        reason: error instanceof Error ? error.message : "Lookup failed",
      });
    }

    await sleep(SCRYFALL_DELAY_MS);
  }

  return result;
}
