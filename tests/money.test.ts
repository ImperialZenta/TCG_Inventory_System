import { describe, expect, it } from "vitest";
import {
  centsFromUsd,
  formatMoney,
  sumLineValueCents,
  usdFromCents,
} from "@/lib/money";

describe("money helpers (ADR-003)", () => {
  it("converts USD to cents with half-up rounding", () => {
    expect(centsFromUsd(12.5)).toBe(1250);
    expect(centsFromUsd(0.005)).toBe(1);
    expect(centsFromUsd(4.004)).toBe(400);
    expect(centsFromUsd(4.005)).toBe(401);
  });

  it("returns null for missing prices", () => {
    expect(centsFromUsd(null)).toBeNull();
    expect(centsFromUsd(undefined)).toBeNull();
  });

  it("formats cents for display", () => {
    expect(formatMoney(1250)).toBe("$12.50");
    expect(usdFromCents(1250)).toBe(12.5);
  });

  it("sums line values excluding null prices", () => {
    expect(
      sumLineValueCents([
        { quantity: 1, priceCents: 1250 },
        { quantity: 2, priceCents: 350 },
        { quantity: 1, priceCents: null },
      ]),
    ).toBe(1950);
  });
});
