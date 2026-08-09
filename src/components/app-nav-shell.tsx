import { createElement } from "react";
import { getCurrentSession } from "@/lib/auth";
import type { ValidatedSession } from "@/lib/auth/sessions";
import { AppNav } from "./app-nav";

export function sessionToNavProps(session: ValidatedSession | null) {
  return {
    displayName: session?.displayName ?? null,
    role: session?.role ?? null,
  };
}

export async function AppNavShell() {
  const session = await getCurrentSession();
  const props = sessionToNavProps(session);

  return createElement(AppNav, props);
}
