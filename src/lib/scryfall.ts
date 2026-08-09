export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  collector_number: string;
  lang: string;
  finishes: string[];
  image_uris?: {
    small?: string;
    normal?: string;
  };
  card_faces?: Array<{
    image_uris?: {
      small?: string;
      normal?: string;
    };
  }>;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
}

const SCRYFALL_BASE = "https://api.scryfall.com";

/** Scryfall rejects default library User-Agent strings with HTTP 400. */
const SCRYFALL_HEADERS = {
  Accept: "application/json;q=0.9,*/*;q=0.8",
  "User-Agent": "TCGInventorySystem/1.0 (https://github.com/andrew/tcg-inventory)",
};

async function scryfallFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...SCRYFALL_HEADERS, ...init?.headers },
  });
}

export async function searchScryfallCards(query: string): Promise<ScryfallCard[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    unique: "cards",
    order: "name",
  });

  const res = await scryfallFetch(`${SCRYFALL_BASE}/cards/search?${params}`, {
    next: { revalidate: 3600 },
  });

  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`Scryfall search failed: ${res.status}`);
  }

  const data = (await res.json()) as { data: ScryfallCard[] };
  return data.data ?? [];
}

export async function getScryfallCardBySetAndNumber(
  setCode: string,
  collectorNumber: string,
): Promise<ScryfallCard | null> {
  const res = await scryfallFetch(
    `${SCRYFALL_BASE}/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber)}`,
    { next: { revalidate: 3600 } },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Scryfall lookup failed: ${res.status}`);
  }

  return (await res.json()) as ScryfallCard;
}

export async function getScryfallCardById(id: string): Promise<ScryfallCard | null> {
  const res = await scryfallFetch(`${SCRYFALL_BASE}/cards/${encodeURIComponent(id)}`, {
    next: { revalidate: 3600 },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Scryfall lookup failed: ${res.status}`);
  }

  return (await res.json()) as ScryfallCard;
}

import { centsFromUsd } from "@/lib/money";

export function getCardImageUri(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.small ??
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal
  );
}

export function getCardPriceUsd(card: ScryfallCard, finish: "NONFOIL" | "FOIL" | "ETCHED"): number | null {
  const prices = card.prices;
  if (!prices) return null;

  const raw =
    finish === "FOIL"
      ? prices.usd_foil
      : finish === "ETCHED"
        ? prices.usd_etched
        : prices.usd;

  if (!raw) return null;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getCardPriceCents(
  card: ScryfallCard,
  finish: "NONFOIL" | "FOIL" | "ETCHED",
): number | null {
  return centsFromUsd(getCardPriceUsd(card, finish));
}
