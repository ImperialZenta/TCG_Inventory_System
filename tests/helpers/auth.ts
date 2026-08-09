import type { MembershipRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createInitialOwner } from "@/lib/auth/bootstrap";
import { createSession, validateSessionToken } from "@/lib/auth/sessions";
import { sessionToDomainContext } from "@/lib/context/domain-context";

export async function createTestOwner(input?: {
  email?: string;
  password?: string;
  displayName?: string;
}) {
  const email = input?.email ?? "owner@test.local";
  const password = input?.password ?? "password123";
  const displayName = input?.displayName ?? "Test Owner";

  const { userId } = await createInitialOwner({ email, displayName, password });
  const { token } = await createSession(userId);
  const session = await validateSessionToken(token);
  if (!session) {
    throw new Error("Failed to create test session");
  }

  return {
    userId,
    email,
    password,
    displayName,
    token,
    session,
    ctx: sessionToDomainContext(session, "test"),
  };
}

export async function createTestStaff(
  ownerCtx: Awaited<ReturnType<typeof createTestOwner>>["ctx"],
  input?: { email?: string; password?: string; role?: MembershipRole },
) {
  const { createUser } = await import("@/lib/auth/users");
  const email = input?.email ?? "staff@test.local";
  const password = input?.password ?? "staffpass123";
  const role = input?.role ?? "STAFF";
  await createUser(ownerCtx, {
    email,
    displayName: "Test Staff",
    password,
    role,
  });
  return { email, password, role };
}

export async function createTestUserWithSession(input: {
  ownerCtx: Awaited<ReturnType<typeof createTestOwner>>["ctx"];
  email?: string;
  password?: string;
  role?: MembershipRole;
}) {
  const email = input.email ?? `${input.role?.toLowerCase() ?? "staff"}@test.local`;
  const password = input.password ?? "staffpass123";
  const role = input.role ?? "STAFF";

  await createTestStaff(input.ownerCtx, { email, password, role });

  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const { token } = await createSession(user.id);
  const session = await validateSessionToken(token);
  if (!session) {
    throw new Error("Failed to create test session");
  }

  return {
    email,
    password,
    role,
    token,
    session,
    ctx: sessionToDomainContext(session, "test"),
  };
}

export async function truncateAuthTables(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "Session", "OrganizationMembership", "User", "Organization" RESTART IDENTITY CASCADE`,
  );
  await db.organization.create({ data: { slug: "default", name: "Test Shop" } });
}
