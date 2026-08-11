import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import { PERMISSIONS, roleCanPerform } from "@/lib/auth/permissions";

/** Redirect read-only and unsigned users away from upload session pages. */
export async function requireUploadSessionPageAccess() {
  const session = await getCurrentSession();
  if (!session?.role || !roleCanPerform(session.role, PERMISSIONS.UPLOAD_SESSION_CREATE)) {
    redirect("/inventory");
  }
  return session;
}
