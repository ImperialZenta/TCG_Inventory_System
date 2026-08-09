import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";

export async function StaffAccountsLink() {
  const session = await getCurrentSession();
  if (session?.role !== "OWNER") {
    return null;
  }

  return (
    <Link
      href="/settings/users"
      className="mt-4 inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
    >
      Manage staff accounts
    </Link>
  );
}
