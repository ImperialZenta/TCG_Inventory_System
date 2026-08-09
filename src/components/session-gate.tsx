import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

const AUTH_PATHS = new Set(["/login", "/setup"]);

export async function SessionGate({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  if (AUTH_PATHS.has(pathname)) {
    return children;
  }

  const session = await getCurrentSession();
  if (!session) {
    const loginUrl = pathname && pathname !== "/" ? `/login?callbackUrl=${encodeURIComponent(pathname)}` : "/login";
    redirect(loginUrl);
  }

  return children;
}
