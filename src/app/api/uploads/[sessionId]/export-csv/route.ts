import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth/require-api-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getUploadSessionCsvForDownload, UploadSessionError } from "@/lib/upload-sessions";

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireApiPermission(PERMISSIONS.UPLOAD_SESSION_CREATE);
  if (!auth.ok) {
    return auth.response;
  }

  const { sessionId } = await params;

  try {
    const { csv, filename } = await getUploadSessionCsvForDownload(sessionId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof UploadSessionError ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
