import Link from "next/link";
import { PageHeader, Badge, EmptyState } from "@/components/page-header";
import {
  BLOCK_CHANNEL_LABELS,
  UPLOAD_SESSION_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { listUploadSessions } from "@/lib/upload-sessions";
import { requireUploadSessionPageAccess } from "@/lib/auth/upload-access";

export const dynamic = "force-dynamic";

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

export default async function UploadsPage() {
  await requireUploadSessionPageAccess();

  let sessions: Awaited<ReturnType<typeof listUploadSessions>> = [];
  let dbError = false;

  try {
    sessions = await listUploadSessions();
  } catch {
    dbError = true;
  }

  const open = sessions.filter((s) => s.status === "DRAFT" || s.status === "CSV_READY");
  const closed = sessions.filter((s) => s.status === "COMPLETED" || s.status === "CANCELLED");

  return (
    <>
      <PageHeader
        title="Upload Sessions"
        description="Batch sealed blocks into one Mana Pool CSV, upload externally, then complete to mark all blocks active."
        action={
          <Link
            href="/uploads/new"
            className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            New upload session
          </Link>
        }
      />

      {dbError && (
        <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Database not ready. Run migrations — see README.
        </div>
      )}

      {sessions.length === 0 ? (
        <EmptyState
          title="No upload sessions yet"
          description="Select sealed blocks and create a session to generate a merged Mana Pool CSV."
          action={
            <Link
              href="/uploads/new"
              className="inline-flex rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
            >
              Create session
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-100">Open</h2>
              <div className="space-y-2">
                {open.map((session) => (
                  <Link
                    key={session.id}
                    href={`/uploads/${session.sessionId}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 transition hover:border-zinc-700"
                  >
                    <div>
                      <span className="font-mono text-zinc-100">{session.sessionId}</span>
                      <span className="ml-3 text-sm text-zinc-500">
                        {BLOCK_CHANNEL_LABELS[session.channel]} · {session.blockCount} block
                        {session.blockCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Badge variant={statusVariant(session.status)}>
                      {UPLOAD_SESSION_STATUS_LABELS[session.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-100">Recent</h2>
              <div className="space-y-2">
                {closed.map((session) => (
                  <Link
                    key={session.id}
                    href={`/uploads/${session.sessionId}`}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 transition hover:border-zinc-700"
                  >
                    <div>
                      <span className="font-mono text-zinc-300">{session.sessionId}</span>
                      <span className="ml-3 text-sm text-zinc-500">
                        {formatDate(session.completedAt ?? session.createdAt)}
                      </span>
                    </div>
                    <Badge variant={statusVariant(session.status)}>
                      {UPLOAD_SESSION_STATUS_LABELS[session.status]}
                    </Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <p className="mt-8 text-sm text-zinc-500">
        Per-block CSV export and manual &quot;Mark as listed&quot; remain on each block detail page.
      </p>
    </>
  );
}
