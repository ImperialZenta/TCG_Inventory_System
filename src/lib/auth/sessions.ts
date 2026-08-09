import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  await db.session.deleteMany({ where: { tokenHash } });
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function touchSession(sessionId: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { lastSeenAt: new Date() },
  });
}

export interface ValidatedSession {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  enabled: boolean;
  organizationId: string;
  role: import("@prisma/client").MembershipRole;
}

export async function validateSessionToken(token: string): Promise<ValidatedSession | null> {
  const tokenHash = hashSessionToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          memberships: {
            include: { organization: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } });
    return null;
  }

  const membership = session.user.memberships[0];
  if (!membership) {
    return null;
  }

  if (!session.user.enabled) {
    return null;
  }

  await touchSession(session.id);

  return {
    sessionId: session.id,
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    enabled: session.user.enabled,
    organizationId: membership.organizationId,
    role: membership.role,
  };
}
