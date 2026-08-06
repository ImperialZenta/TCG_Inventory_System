const MAX_VISIBLE_BLOCK_IDS = 3;

/** Short display for staging list rows, e.g. "MTG-0008–0010" or "MTG-0001, MTG-0002 +2 more". */
export function formatBlockIdListSummary(blockIds: string[]): string | null {
  if (blockIds.length === 0) return null;

  const sorted = [...blockIds].sort();
  if (sorted.length === 1) return sorted[0];

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const firstMatch = first.match(/^(.+-)(\d+)$/);
  const lastMatch = last.match(/^(.+-)(\d+)$/);

  if (
    sorted.length >= 2 &&
    firstMatch &&
    lastMatch &&
    firstMatch[1] === lastMatch[1]
  ) {
    const pad = firstMatch[2].length;
    const nums = sorted.map((id) => {
      const m = id.match(/^(.+-)(\d+)$/);
      return m ? m[2] : id;
    });
    const allSequential = nums.every((num, i) => {
      if (i === 0) return true;
      const prev = Number.parseInt(nums[i - 1], 10);
      const curr = Number.parseInt(num, 10);
      return curr === prev + 1;
    });

    if (allSequential) {
      return `${firstMatch[1]}${nums[0].padStart(pad, "0")}–${nums[nums.length - 1].padStart(pad, "0")}`;
    }
  }

  const visible = sorted.slice(0, MAX_VISIBLE_BLOCK_IDS);
  const hidden = sorted.length - visible.length;
  if (hidden > 0) {
    return `${visible.join(", ")} +${hidden} more`;
  }
  return visible.join(", ");
}
