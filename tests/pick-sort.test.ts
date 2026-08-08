import { describe, expect, it } from "vitest";
import { sortPickItems } from "@/lib/pick/sort-items";
import type { PickItemWithRelations } from "@/lib/pick/sort-items";

function makeItem(
  id: string,
  shelfCode: string,
  binId: string,
  blockId: string,
  position: number,
): PickItemWithRelations {
  return {
    id,
    pickListId: "pl1",
    pickWaveId: null,
    cardLineId: id,
    blockId: blockId,
    externalOrderId: null,
    externalOrderLineId: null,
    quantity: 1,
    status: "PENDING",
    shortReason: null,
    notes: null,
    cardLine: {
      id,
      blockId,
      scryfallId: null,
      name: "Card",
      setCode: "tst",
      collectorNumber: null,
      finish: "NONFOIL",
      language: "en",
      condition: "NM",
      quantity: 1,
      position,
      isBulkLine: false,
      bulkDescription: null,
      priceUsd: null,
      imageUri: null,
      addedAt: new Date(),
    },
    externalOrderLine: null,
    block: {
      id: blockId,
      blockId: `MTG-${blockId}`,
      label: null,
      status: "ACTIVE",
      tier: "GENERAL",
      channel: "MANAPOOL",
      binId: "bin1",
      packedAt: new Date(),
      sealedAt: new Date(),
      lastPickAt: null,
      activatedAt: new Date(),
      targetCount: null,
      notes: null,
      pickHoldAt: null,
      pickHoldReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      bin: {
        id: "bin1",
        binId,
        shelfId: "shelf1",
        label: null,
        sortOrder: parseInt(binId.replace(/\D/g, "") || "1", 10),
        createdAt: new Date(),
        updatedAt: new Date(),
        shelf: {
          id: "shelf1",
          code: shelfCode,
          label: null,
          sortOrder: shelfCode === "A" ? 1 : 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      cards: [],
    },
  } as PickItemWithRelations;
}

describe("sortPickItems", () => {
  it("orders by shelf, bin, block, then position", () => {
    const items = [
      makeItem("i3", "B", "B-01", "b2", 5),
      makeItem("i1", "A", "A-01", "b1", 14),
      makeItem("i2", "A", "A-01", "b1", 3),
    ];

    const sorted = sortPickItems(items);
    expect(sorted.map((i) => i.id)).toEqual(["i2", "i1", "i3"]);
  });
});
