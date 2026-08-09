import { NextResponse } from "next/server";
import { suggestNextBinId, suggestNextShelfCode } from "@/lib/blocks";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireApiPermission } from "@/lib/auth/require-api-auth";

export async function GET(request: Request) {
  const auth = await requireApiPermission(PERMISSIONS.SETTINGS_STRUCTURE);
  if (!auth.ok) {
    return auth.response;
  }

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
