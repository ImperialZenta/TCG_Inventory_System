import { NextResponse } from "next/server";
import { searchScryfallCards } from "@/lib/scryfall";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ data: [] });
  }

  try {
    const cards = await searchScryfallCards(q);
    return NextResponse.json({ data: cards.slice(0, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
