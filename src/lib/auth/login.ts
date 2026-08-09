import { db } from "@/lib/db";
import { verifyPassword } from "./passwords";

export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  displayName: string;
  organizationId: string;
  role: import("@prisma/client").MembershipRole;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        include: { organization: true },
        take: 1,
      },
    },
  });

  if (!user || !user.enabled) {
    return null;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return null;
  }

  const membership = user.memberships[0];
  if (!membership) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}
