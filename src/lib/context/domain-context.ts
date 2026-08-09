import type { MembershipRole } from "@prisma/client";
import { getCurrentSession } from "@/lib/auth/get-session";
import { UnauthorizedError } from "@/lib/auth/errors";

/**
 * Domain context for inventory mutations (ADR-001, ADR-002).
 * Actor and role are resolved server-side from the session (ACC-001).
 */
export interface DomainContext {
  actor: { id: string; email?: string; displayName?: string } | null;
  organizationId: string | null;
  role: MembershipRole | null;
  source: "ui" | "api" | "webhook" | "test";
}

export const SYSTEM_CONTEXT: DomainContext = {
  actor: null,
  organizationId: null,
  role: null,
  source: "ui",
};

export const TEST_CONTEXT: DomainContext = {
  actor: null,
  organizationId: null,
  role: null,
  source: "test",
};

/** Domain tests that bypass action-layer auth should pass this with OWNER role. */
export const TEST_OWNER_CONTEXT: DomainContext = {
  actor: { id: "test-owner", displayName: "Test Owner" },
  organizationId: null,
  role: "OWNER",
  source: "test",
};

export function sessionToDomainContext(
  session: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>,
  source: DomainContext["source"] = "ui",
): DomainContext {
  return {
    actor: {
      id: session.userId,
      email: session.email,
      displayName: session.displayName,
    },
    organizationId: session.organizationId,
    role: session.role,
    source,
  };
}

export async function getDomainContext(
  source: DomainContext["source"] = "ui",
): Promise<DomainContext> {
  const session = await getCurrentSession();
  if (!session) {
    return { actor: null, organizationId: null, role: null, source };
  }
  return sessionToDomainContext(session, source);
}

export async function requireAuthContext(
  source: DomainContext["source"] = "ui",
): Promise<DomainContext> {
  const ctx = await getDomainContext(source);
  if (!ctx.actor) {
    throw new UnauthorizedError();
  }
  return ctx;
}
