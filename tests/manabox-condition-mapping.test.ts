import "./helpers/next-headers-mock";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { uploadStagingCsv, formalizeStagingImportAction } from "@/app/staging/actions";
import { CONDITION_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { mapManaboxCondition } from "@/lib/languages";
import { parseManaboxCsv } from "@/lib/manabox/csv-import";
import * as scryfall from "@/lib/scryfall";
import { createTestOwner } from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";

/** C-007 / ADR-012: ManaBox seven-grade CSV values → TCGplayer-aligned internal codes. */
const MANABOX_TO_INTERNAL: Array<[string, "NM" | "LP" | "MP" | "HP" | "DMG"]> = [
  ["mint", "NM"],
  ["near_mint", "NM"],
  ["excellent", "LP"],
  ["good", "MP"],
  ["light_played", "HP"],
  ["played", "HP"],
  ["poor", "DMG"],
];

function nearMintCsvRow(name = "Lightning Bolt"): string {
  return `${name},LEA,161,1,near_mint`;
}

describe("C-007 ManaBox condition import mapping", () => {
  describe("mapManaboxCondition", () => {
    it.each(MANABOX_TO_INTERNAL)("maps ManaBox %s to %s", (manabox, internal) => {
      expect(mapManaboxCondition(manabox)).toBe(internal);
    });

    it("accepts spaced ManaBox labels", () => {
      expect(mapManaboxCondition("Near Mint")).toBe("NM");
      expect(mapManaboxCondition("Light Played")).toBe("HP");
    });
  });

  describe("parseManaboxCsv", () => {
    it("maps all seven ManaBox grades in one CSV", async () => {
      const header = "Name,Set code,Collector number,Quantity,Condition";
      const dataRows = MANABOX_TO_INTERNAL.map(
        ([grade], index) => `Card ${index + 1},lea,${index + 1},1,${grade}`,
      );
      const raw = [header, ...dataRows].join("\n");

      const { rows, errors } = await parseManaboxCsv(raw);

      expect(errors).toEqual([]);
      expect(rows).toHaveLength(MANABOX_TO_INTERNAL.length);
      for (let i = 0; i < MANABOX_TO_INTERNAL.length; i++) {
        expect(rows[i]?.condition).toBe(MANABOX_TO_INTERNAL[i]![1]);
      }
    });

    it("maps near_mint fixture rows to NM", async () => {
      vi.spyOn(scryfall, "getScryfallCardById").mockResolvedValue(null);

      const fixturePath = join(import.meta.dirname, "..", "docs", "fixtures", "staging-01-single-block.csv");
      const raw = readFileSync(fixturePath, "utf8");
      const { rows, errors } = await parseManaboxCsv(raw);

      expect(errors).toEqual([]);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.condition).toBe("NM");
      }

      vi.restoreAllMocks();
    });

    it("defaults empty condition to NM", async () => {
      const raw = [
        "Name,Set code,Collector number,Quantity,Condition",
        "Lightning Bolt,LEA,161,1,",
      ].join("\n");
      const { rows, errors } = await parseManaboxCsv(raw);
      expect(errors).toEqual([]);
      expect(rows[0]?.condition).toBe("NM");
    });

    it("accepts literal TCGplayer abbreviations in CSV", async () => {
      const raw = [
        "Name,Set code,Collector number,Quantity,Condition",
        "Lightning Bolt,LEA,161,1,LP",
      ].join("\n");
      const { rows, errors } = await parseManaboxCsv(raw);
      expect(errors).toEqual([]);
      expect(rows[0]?.condition).toBe("LP");
    });
  });

  it("displays NM as Near Mint in the UI vocabulary", () => {
    expect(CONDITION_LABELS.NM).toBe("Near Mint");
  });

  describe("staging upload and formalize (integration)", () => {
    let binId: string;

    beforeEach(async () => {
      clearMockCookies();
      ({ binId } = await resetTestDb());
      const owner = await createTestOwner();
      setMockSessionCookie(owner.token);
    });

    afterAll(async () => {
      await disconnectTestDb();
    });

    it("uploadStagingCsv persists near_mint as NM on staging cards", async () => {
      const raw = [
        "Name,Set code,Collector number,Quantity,Condition",
        nearMintCsvRow(),
      ].join("\n");
      const form = new FormData();
      form.set("csv", new File([raw], "c007-near-mint.csv", { type: "text/csv" }));

      const result = await uploadStagingCsv(null, form);
      expect(result.ok, result.message).toBe(true);
      expect(result.importId).toBeDefined();

      const cards = await db.stagingCard.findMany({
        where: { stagingImportId: result.importId },
      });
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.condition).toBe("NM");
      }
      expect(CONDITION_LABELS[cards[0]!.condition]).toBe("Near Mint");
    });

    it("uploadStagingCsv defaults empty condition to NM on staging cards", async () => {
      const raw = [
        "Name,Set code,Collector number,Quantity,Condition",
        "Lightning Bolt,LEA,161,1,",
      ].join("\n");
      const form = new FormData();
      form.set("csv", new File([raw], "c007-empty-condition.csv", { type: "text/csv" }));

      const result = await uploadStagingCsv(null, form);
      expect(result.ok, result.message).toBe(true);

      const cards = await db.stagingCard.findMany({
        where: { stagingImportId: result.importId },
      });
      expect(cards).toHaveLength(1);
      expect(cards[0]?.condition).toBe("NM");
    });

    it("formalize preserves NM from near_mint on block card lines", async () => {
      const raw = [
        "Name,Set code,Collector number,Quantity,Condition",
        nearMintCsvRow(),
      ].join("\n");
      const uploadForm = new FormData();
      uploadForm.set("csv", new File([raw], "c007-formalize.csv", { type: "text/csv" }));

      const upload = await uploadStagingCsv(null, uploadForm);
      expect(upload.ok, upload.message).toBe(true);

      const formalizeForm = new FormData();
      formalizeForm.set("importId", upload.importId!);
      formalizeForm.set("bin_1", binId);

      const formalize = await formalizeStagingImportAction(null, formalizeForm);
      expect(formalize.ok, formalize.message).toBe(true);

      const staged = await db.stagingCard.findFirst({
        where: { stagingImportId: upload.importId, assignedBlockId: { not: null } },
      });
      expect(staged?.assignedBlockId).toBeTruthy();

      const block = await db.block.findUnique({
        where: { id: staged!.assignedBlockId! },
        include: { cards: true },
      });
      expect(block?.cards.length).toBeGreaterThan(0);
      for (const line of block!.cards) {
        expect(line.condition).toBe("NM");
      }
    });
  });
});
