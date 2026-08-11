import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Badge } from "@/components/page-header";
import {
  BLOCK_CHANNEL_LABELS,
  UPLOAD_SESSION_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getUploadSessionDetail } from "@/lib/upload-sessions";
import { getCatalogDriftWarnings } from "@/lib/channel-catalogs";
import { requireUploadSessionPageAccess } from "@/lib/auth/upload-access";
import { PERMISSIONS, roleCanPerform } from "@/lib/auth/permissions";
import { SessionActions } from "./session-actions";

export const dynamic = "force-dynamic";

interface UploadSessionPageProps {
  params: Promise<{ sessionId: string }>;
}

function statusVariant(status: string): "default" | "warning" | "success" | "muted" {
  switch (status) {
    case "DRAFT":
      return "warning";
    case "CSV_READY":
      return "default";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "muted";
    default:
      return "default";
  }
}

export default async function UploadSessionPage({ params }: UploadSessionPageProps) {
  const sessionUser = await requireUploadSessionPageAccess();
  const { sessionId } = await params;
  const session = await getUploadSessionDetail(sessionId);

  if (!session) {
    notFound();
  }

  const catalogDriftWarnings =
    session.status === "DRAFT" || session.status === "CSV_READY"
      ? await getCatalogDriftWarnings(session.sessionId)
      : [];

  return (
    <>
      <PageHeader
        title={session.sessionId}
        description={`${BLOCK_CHANNEL_LABELS[session.channel]} upload session`}
        action={
          <Link
            href="/uploads"
            className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            All sessions
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <Badge variant={statusVariant(session.status)}>
          {UPLOAD_SESSION_STATUS_LABELS[session.status]}
        </Badge>
        <span>Created {formatDate(session.createdAt)}</span>
        {session.createdBy && <span>by {session.createdBy}</span>}
        {session.completedAt && <span>Completed {formatDate(session.completedAt)}</span>}
        {session.cancelledAt && <span>Cancelled {formatDate(session.cancelledAt)}</span>}
      </div>

      {catalogDriftWarnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">Catalog location drift</p>
          <ul className="mt-2 space-y-1">
            {catalogDriftWarnings.map((warning) => (
              <li key={warning.blockId}>
                {warning.message}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-200/80">
            Session membership is unchanged — blocks stay in this session by ID even after moves or
            catalog changes.
          </p>
        </div>
      )}

      <SessionActions
        sessionId={session.sessionId}
        status={session.status}
        csvGeneratedAt={session.csvGeneratedAt}
        latestExport={session.latestExport}
        blocks={session.blocks}
        canComplete={roleCanPerform(sessionUser.role, PERMISSIONS.UPLOAD_SESSION_COMPLETE)}
      />
    </>
  );
}
