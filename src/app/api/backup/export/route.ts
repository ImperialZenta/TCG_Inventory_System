import { NextResponse } from "next/server";
import { exportInventoryBackup } from "@/lib/backup";

export async function GET() {
  try {
    const data = await exportInventoryBackup();
    const filename = `tcg-inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
