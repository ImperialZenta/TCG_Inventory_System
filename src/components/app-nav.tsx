"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MembershipRole } from "@prisma/client";
import { navItemsForRole } from "@/lib/constants";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/auth/constants";
import { signOutAction } from "@/app/auth-actions";

const AUTH_PATHS = ["/login", "/setup"];

export function AppNav({
  displayName,
  role,
}: {
  displayName: string | null;
  role: MembershipRole | null;
}) {
  const pathname = usePathname();

  if (AUTH_PATHS.includes(pathname)) {
    return (
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6">
          <span className="text-lg font-semibold text-zinc-100">TCG Chaos Inventory</span>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
            MTG
          </span>
          <span className="text-lg font-semibold text-zinc-100">Chaos Inventory</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItemsForRole(role).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {displayName && (
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-zinc-200">{displayName}</p>
              {role && (
                <p className="text-xs text-zinc-500">{MEMBERSHIP_ROLE_LABELS[role]}</p>
              )}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-zinc-800 px-4 py-2 md:hidden">
        {navItemsForRole(role).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
