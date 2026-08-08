import { describe, expect, it } from "vitest";
import { parseTcgplayerPullsheetCsv } from "@/lib/tcgplayer/parse-pullsheet";

describe("tcgplayer pullsheet", () => {
  it("parses standard pullsheet columns", () => {
    const csv = `Product Name,Set Name,Condition,Quantity,Printing
Lightning Bolt,Alpha (lea),Near Mint,2,Foil
Counterspell,Alpha (lea),Lightly Played,1,Normal`;

    const result = parseTcgplayerPullsheetCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.name).toBe("Lightning Bolt");
    expect(result.lines[0]?.finish).toBe("FOIL");
    expect(result.lines[0]?.quantity).toBe(2);
    expect(result.lines[1]?.condition).toBe("LP");
  });
});
