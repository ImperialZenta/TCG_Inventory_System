import type { Condition, Finish } from "@prisma/client";
import type { ImportedOrderDTO, ImportedOrderLineDTO } from "@/lib/orders/types";

const CONDITION_MAP: Record<string, Condition> = {
  NM: "NM",
  NEAR_MINT: "NM",
  "NEAR MINT": "NM",
  LP: "LP",
  LIGHTLY_PLAYED: "LP",
  MP: "MP",
  MODERATELY_PLAYED: "MP",
  HP: "HP",
  HEAVILY_PLAYED: "HP",
  DMG: "DMG",
  DAMAGED: "DMG",
};

const FINISH_MAP: Record<string, Finish> = {
  NONFOIL: "NONFOIL",
  NON_FOIL: "NONFOIL",
  FOIL: "FOIL",
  ETCHED: "ETCHED",
};

function normalizeCondition(raw: unknown): Condition {
  if (typeof raw !== "string") return "NM";
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return CONDITION_MAP[key] ?? "NM";
}

function normalizeFinish(raw: unknown): Finish {
  if (typeof raw !== "string") return "NONFOIL";
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return FINISH_MAP[key] ?? "NONFOIL";
}

function normalizeLine(raw: Record<string, unknown>): ImportedOrderLineDTO {
  const quantity =
    typeof raw.quantity === "number"
      ? raw.quantity
      : Number.parseInt(String(raw.quantity ?? 1), 10);

  return {
    manapoolLineId:
      typeof raw.id === "string"
        ? raw.id
        : typeof raw.manapoolLineId === "string"
          ? raw.manapoolLineId
          : undefined,
    scryfallId:
      typeof raw.scryfallId === "string"
        ? raw.scryfallId
        : typeof raw.scryfall_id === "string"
          ? raw.scryfall_id
          : undefined,
    name: String(raw.name ?? raw.product_name ?? "Unknown"),
    setCode:
      typeof raw.setCode === "string"
        ? raw.setCode
        : typeof raw.set_code === "string"
          ? raw.set_code
          : typeof raw.set === "string"
            ? raw.set
            : undefined,
    collectorNumber:
      typeof raw.collectorNumber === "string"
        ? raw.collectorNumber
        : typeof raw.collector_number === "string"
          ? raw.collector_number
          : undefined,
    condition: normalizeCondition(raw.condition),
    finish: normalizeFinish(raw.finish),
    language: typeof raw.language === "string" ? raw.language.toLowerCase() : "en",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    priceCents:
      typeof raw.priceCents === "number"
        ? raw.priceCents
        : typeof raw.price_cents === "number"
          ? raw.price_cents
          : undefined,
  };
}

function normalizeOrder(raw: Record<string, unknown>): ImportedOrderDTO {
  const id =
    typeof raw.id === "string"
      ? raw.id
      : typeof raw.manapoolOrderId === "string"
        ? raw.manapoolOrderId
        : typeof raw.order_id === "string"
          ? raw.order_id
          : null;

  if (!id) {
    throw new Error("Order missing id");
  }

  const linesRaw = Array.isArray(raw.lines)
    ? raw.lines
    : Array.isArray(raw.items)
      ? raw.items
      : [];

  return {
    manapoolOrderId: id,
    reference:
      typeof raw.reference === "string"
        ? raw.reference
        : typeof raw.order_number === "string"
          ? raw.order_number
          : undefined,
    lines: linesRaw.map((line) => normalizeLine(line as Record<string, unknown>)),
  };
}

/** Normalize a single order or fixture wrapper `{ orders: [...] }`. */
export function normalizeOrdersFromFixture(json: unknown): ImportedOrderDTO[] {
  if (Array.isArray(json)) {
    return json.map((item) => normalizeOrder(item as Record<string, unknown>));
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (Array.isArray(obj.orders)) {
      return obj.orders.map((item) => normalizeOrder(item as Record<string, unknown>));
    }
    return [normalizeOrder(obj)];
  }

  throw new Error("Invalid fixture JSON");
}

export function normalizeOrderFromApi(json: unknown): ImportedOrderDTO {
  if (!json || typeof json !== "object") {
    throw new Error("Invalid API order response");
  }
  return normalizeOrder(json as Record<string, unknown>);
}
