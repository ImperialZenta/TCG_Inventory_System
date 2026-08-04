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

export async function searchScryfallCards(query: string): Promise<ScryfallCard[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    unique: "cards",
    order: "name",
  });

  const res = await fetch(`${SCRYFALL_BASE}/cards/search?${params}`, {
    headers: { Accept: "application/json" },
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
  const res = await fetch(
    `${SCRYFALL_BASE}/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(collectorNumber)}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Scryfall lookup failed: ${res.status}`);
  }

  return (await res.json()) as ScryfallCard;
}

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
