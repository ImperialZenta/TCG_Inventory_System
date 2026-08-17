import "./helpers/next-navigation-mock";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PackOrderSection, type PackOrderCard } from "@/components/staging/pack-order-section";
import {
  SortableBlockCardList,
  moveCard,
  parseJumpPosition,
} from "@/components/staging/sortable-block-card-list";
import type { StagingReviewGroup } from "@/lib/staging/review";
import { CONDITION_LABELS, FINISH_LABELS } from "@/lib/constants";

vi.mock("@/app/staging/actions", () => ({
  reorderStagingBlockAction: vi.fn(),
}));

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));

const sampleGroups: StagingReviewGroup[] = [
  {
    blockIndex: 1,
    totalQuantity: 2,
    lineCount: 2,
    cards: [
      {
        id: "card-1",
        stagingImportId: "import-1",
        name: "Lightning Bolt",
        setCode: "lea",
        collectorNumber: "161",
        finish: "NONFOIL",
        language: "en",
        condition: "NM",
        quantity: 1,
        position: 1,
        expansionIndex: 0,
        suggestedBlock: 1,
        assignedBlockId: null,
        sourceRow: 1,
        scryfallId: null,
        priceCents: null,
        imageUri: null,
        createdAt: new Date("2026-08-15T00:00:00Z"),
      },
      {
        id: "card-2",
        stagingImportId: "import-1",
        name: "Counterspell",
        setCode: "lea",
        collectorNumber: "54",
        finish: "FOIL",
        language: "en",
        condition: "LP",
        quantity: 1,
        position: 2,
        expansionIndex: 0,
        suggestedBlock: 1,
        assignedBlockId: null,
        sourceRow: 2,
        scryfallId: null,
        priceCents: null,
        imageUri: null,
        createdAt: new Date("2026-08-15T00:00:00Z"),
      },
    ],
  },
  {
    blockIndex: 2,
    totalQuantity: 1,
    lineCount: 1,
    cards: [
      {
        id: "card-3",
        stagingImportId: "import-1",
        name: "Sol Ring",
        setCode: "c21",
        collectorNumber: "263",
        finish: "NONFOIL",
        language: "en",
        condition: "NM",
        quantity: 1,
        position: 1,
        expansionIndex: 0,
        suggestedBlock: 2,
        assignedBlockId: null,
        sourceRow: 3,
        scryfallId: null,
        priceCents: null,
        imageUri: null,
        createdAt: new Date("2026-08-15T00:00:00Z"),
      },
    ],
  },
];

describe("I-027 pack order UI", () => {
  it("shows an expandable pack-order section for each suggested block", () => {
    const html = renderToStaticMarkup(
      createElement(PackOrderSection, {
        importId: "import-1",
        groups: sampleGroups,
        totalBlocks: 2,
      }),
    );

    expect(html).toContain("Pack order");
    expect(html).toContain("right-click / click the number to jump");
    expect(html).toContain("Block 1 / 2");
    expect(html).toContain("Block 2 / 2");
    expect(html).toContain("Edit order");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Lightning Bolt");
  });

  it("lists cards in position order with name, set, condition and finish when expanded", () => {
    const html = renderToStaticMarkup(
      createElement(SortableBlockCardList, {
        importId: "import-1",
        blockIndex: 1,
        cards: sampleGroups[0]!.cards.map((card) => ({
          id: card.id,
          name: card.name,
          setCode: card.setCode,
          condition: card.condition,
          finish: card.finish,
          position: card.position,
          sourceRow: card.sourceRow,
          expansionIndex: card.expansionIndex,
        })),
      }),
    );

    expect(html).toContain("Lightning Bolt");
    expect(html).toContain("Counterspell");
    expect(html).toContain("lea");
    expect(html).toContain(CONDITION_LABELS.NM);
    expect(html).toContain(CONDITION_LABELS.LP);
    expect(html).toContain(FINISH_LABELS.NONFOIL);
    expect(html).toContain(FINISH_LABELS.FOIL);
    expect(html).toContain("Save order");
    expect(html).toContain("Move Lightning Bolt to a position");
    expect(html).not.toContain("Move Lightning Bolt up");
    expect(html).not.toContain("Move Lightning Bolt down");
    expect(html).not.toContain(">↑<");
    expect(html).not.toContain(">↓<");
    expect(html.indexOf("Lightning Bolt")).toBeLessThan(html.indexOf("Counterspell"));
  });
});

function namedCards(ids: string[]): PackOrderCard[] {
  return ids.map((id, index) => ({
    id,
    name: id,
    setCode: "lea",
    condition: "NM",
    finish: "NONFOIL",
    position: index + 1,
    sourceRow: index + 1,
    expansionIndex: 0,
  }));
}

describe("moveCard", () => {
  const deck = namedCards(["A", "B", "C", "D", "E"]);

  it("moves a card down so later cards shift up", () => {
    expect(moveCard(deck, 0, 3).map((card) => card.id)).toEqual(["B", "C", "D", "A", "E"]);
  });

  it("moves a card up so later cards shift down", () => {
    expect(moveCard(deck, 4, 1).map((card) => card.id)).toEqual(["A", "E", "B", "C", "D"]);
  });

  it("returns the same array for the same slot or an out-of-range index", () => {
    expect(moveCard(deck, 2, 2)).toBe(deck);
    expect(moveCard(deck, -1, 1)).toBe(deck);
    expect(moveCard(deck, 0, 5)).toBe(deck);
    expect(moveCard(deck, 5, 0)).toBe(deck);
  });
});

describe("parseJumpPosition", () => {
  it("accepts integers in 1…N", () => {
    expect(parseJumpPosition("3", 10)).toBe(3);
    expect(parseJumpPosition("10", 10)).toBe(10);
    expect(parseJumpPosition("1", 10)).toBe(1);
  });

  it("rejects empty, out of range, alpha, and special characters", () => {
    expect(parseJumpPosition("", 10)).toBeNull();
    expect(parseJumpPosition("0", 10)).toBeNull();
    expect(parseJumpPosition("11", 10)).toBeNull();
    expect(parseJumpPosition("3.5", 10)).toBeNull();
    expect(parseJumpPosition("-1", 10)).toBeNull();
    expect(parseJumpPosition("1e2", 10)).toBeNull();
    expect(parseJumpPosition("ab", 10)).toBeNull();
    expect(parseJumpPosition("3 ", 10)).toBeNull();
    expect(parseJumpPosition("1-2", 10)).toBeNull();
  });
});
