import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";
import { PERMISSIONS, roleCanPerform } from "@/lib/auth/permissions";

/** Redirect users without catalog configure permission away from /catalogs. */
export async function requireCatalogConfigureAccess() {
  const session = await getCurrentSession();
  if (!session?.role || !roleCanPerform(session.role, PERMISSIONS.CATALOG_CONFIGURE)) {
    redirect("/inventory");
  }
  return session;
}
