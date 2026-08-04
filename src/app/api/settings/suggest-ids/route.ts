import { NextResponse } from "next/server";
import { suggestNextBinId, suggestNextShelfCode } from "@/lib/blocks";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shelf = searchParams.get("shelf") ?? undefined;

  try {
    const nextShelf = await suggestNextShelfCode();
    const nextBin = shelf ? await suggestNextBinId(shelf) : `${nextShelf}-B01`;

    return NextResponse.json({ nextShelf, nextBin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to suggest IDs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
