import { describe, expect, it } from "vitest";
import {
  requiresManaPoolArchiveConfirmation,
  shouldShowManaPoolDelistPlaybook,
} from "@/lib/blocks/mana-pool-delist-playbook";

describe("CHL-013 mana-pool-delist-playbook helpers", () => {
  it.each([
    ["ACTIVE", "MANAPOOL", true],
    ["SEALED", "MANAPOOL", false],
    ["ACTIVE", "TCGPLAYER", false],
    ["ARCHIVED", "MANAPOOL", false],
  ] as const)(
    "shouldShowManaPoolDelistPlaybook(%s, %s) is %s",
    (status, channel, expected) => {
      expect(shouldShowManaPoolDelistPlaybook(status, channel)).toBe(expected);
    },
  );

  it.each([
    ["ACTIVE", "MANAPOOL", "ARCHIVE", true],
    ["ACTIVE", "MANAPOOL", "ACTIVATE", false],
    ["ACTIVE", "MANAPOOL", "LIQUIDATE", false],
    ["SEALED", "MANAPOOL", "ARCHIVE", false],
    ["ACTIVE", "TCGPLAYER", "ARCHIVE", false],
  ] as const)(
    "requiresManaPoolArchiveConfirmation(%s, %s, %s) is %s",
    (status, channel, transition, expected) => {
      expect(requiresManaPoolArchiveConfirmation(status, channel, transition)).toBe(
        expected,
      );
    },
  );
});
