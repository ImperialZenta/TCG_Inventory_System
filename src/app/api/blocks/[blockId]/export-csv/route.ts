import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aggregateCardLinesForListing, toManaPoolCsv } from "@/lib/manapool/csv-export";

interface RouteParams {
  params: Promise<{ blockId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { blockId } = await params;

  const block = await db.block.findUnique({
    where: { blockId },
    include: { cards: true },
  });

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  const rows = aggregateCardLinesForListing(block.cards);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No listable singles in this block (bulk lines are excluded)" },
      { status: 400 },
    );
  }

  const csv = toManaPoolCsv(rows);
  const filename = `${blockId}-manapool-listing.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
