import { NextResponse } from "next/server";
import { exportInventoryBackup } from "@/lib/backup";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { requireApiPermission } from "@/lib/auth/require-api-auth";

export async function GET() {
  const auth = await requireApiPermission(PERMISSIONS.BACKUP_EXPORT);
  if (!auth.ok) {
    return auth.response;
  }

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
