/**
 * Lightweight checks for buildImportAssignmentSummary.
 * Run: npx tsx scripts/assignment-summary-check.ts
 */
import assert from "node:assert/strict";
import { buildImportAssignmentSummary } from "../src/lib/staging/assignment-summary";
import type { LinkedBlock } from "../src/lib/staging/linked-blocks";

const blockA: LinkedBlock = {
  id: "block-a",
  blockId: "MTG-0001",
  status: "OPEN",
  cardCount: 2,
  pickItemCount: 0,
};

const blockB: LinkedBlock = {
  id: "block-b",
  blockId: "MTG-0002",
  status: "OPEN",
  cardCount: 1,
  pickItemCount: 0,
};

const allAssigned = buildImportAssignmentSummary(
  [
    {
      id: "1",
      quantity: 1,
      assignedBlockId: "block-a",
      suggestedBlock: 1,
      position: 1,
      name: "Card A",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
    {
      id: "2",
      quantity: 1,
      assignedBlockId: "block-a",
      suggestedBlock: 1,
      position: 2,
      name: "Card B",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
    {
      id: "3",
      quantity: 1,
      assignedBlockId: "block-b",
      suggestedBlock: 2,
      position: 1,
      name: "Card C",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
  ],
  [blockA, blockB],
);

assert.equal(allAssigned.totalUnits, 3);
assert.equal(allAssigned.unassignedUnits, 0);
assert.equal(allAssigned.inBlockUnits, 3);
assert.equal(allAssigned.isBalanced, true);
assert.equal(allAssigned.cardLinesMatchStaging, true);

const withOrphans = buildImportAssignmentSummary(
  [
    {
      id: "1",
      quantity: 1,
      assignedBlockId: "block-a",
      suggestedBlock: 1,
      position: 1,
      name: "Card A",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
    {
      id: "2",
      quantity: 1,
      assignedBlockId: null,
      suggestedBlock: 2,
      position: 1,
      name: "Orphan",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
  ],
  [blockA],
);

assert.equal(withOrphans.unassignedUnits, 1);
assert.equal(withOrphans.unassignedGroups.length, 1);
assert.equal(withOrphans.unassignedGroups[0]?.suggestedBlock, 2);

const mismatch = buildImportAssignmentSummary(
  [
    {
      id: "1",
      quantity: 2,
      assignedBlockId: "block-a",
      suggestedBlock: 1,
      position: 1,
      name: "Card A",
      setCode: "abc",
      condition: "NM",
      finish: "NONFOIL",
    },
  ],
  [{ ...blockA, cardCount: 1 }],
);

assert.equal(mismatch.cardLinesMatchStaging, false);

console.log("assignment-summary-check: ok");
