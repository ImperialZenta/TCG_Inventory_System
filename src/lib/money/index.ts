/** Monetary amounts are integer cents — see ADR-003. */

export function centsFromUsd(dollars: number | null | undefined): number | null {
  if (dollars == null || Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

export function usdFromCents(cents: number): number {
  return cents / 100;
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(usdFromCents(cents));
}

export function applyPercent(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100);
}

export function roundToIncrement(cents: number, incrementCents: number): number {
  if (incrementCents <= 0) return cents;
  return Math.round(cents / incrementCents) * incrementCents;
}

export interface PricedLine {
  quantity: number;
  priceCents: number | null;
}

export function sumLineValueCents(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + (line.priceCents ?? 0) * line.quantity, 0);
}
