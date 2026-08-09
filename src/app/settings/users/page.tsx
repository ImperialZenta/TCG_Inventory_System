import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentSession } from "@/lib/auth";
import { ForbiddenError } from "@/lib/auth/errors";
import {
  getUsersForOwnerPage,
  toggleUserEnabledFormAction,
  updateUserRoleFormAction,
} from "../users-actions";
import { CreateUserForm, UsersTable } from "./users-client";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const session = await getCurrentSession();
  if (!session || session.role !== "OWNER") {
    redirect("/settings");
  }

  let users: Awaited<ReturnType<typeof getUsersForOwnerPage>> = [];
  let error: string | null = null;

  try {
    users = await getUsersForOwnerPage();
  } catch (e) {
    error = e instanceof ForbiddenError ? e.message : "Could not load users";
  }

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Create, disable, and reset passwords for shop staff. Owner only."
      />
      <Link href="/settings" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to settings
      </Link>

      <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <>
            <UsersTable
              users={users}
              currentUserId={session.userId}
              toggleUserEnabledFormAction={toggleUserEnabledFormAction}
              updateUserRoleFormAction={updateUserRoleFormAction}
            />
            <CreateUserForm />
          </>
        )}
      </section>
    </>
  );
}
