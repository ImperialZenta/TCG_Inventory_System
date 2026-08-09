import { db } from "@/lib/db";
import type { MembershipRole } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { ForbiddenError } from "./errors";
import { requirePermission, PERMISSIONS } from "./permissions";
import { hashPassword, isPasswordStrongEnough } from "./passwords";
import { ensureDefaultOrganization } from "./bootstrap";
import { revokeAllSessionsForUser } from "./sessions";

export interface UserListItem {
  id: string;
  email: string;
  displayName: string;
  role: MembershipRole;
  enabled: boolean;
  createdAt: Date;
}

export async function listUsers(ctx: DomainContext): Promise<UserListItem[]> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
  if (!ctx.organizationId) {
    throw new ForbiddenError();
  }

  const memberships = await db.organizationMembership.findMany({
    where: { organizationId: ctx.organizationId },
    include: { user: true },
    orderBy: { user: { email: "asc" } },
  });

  return memberships.map((m) => ({
    id: m.user.id,
    email: m.user.email,
    displayName: m.user.displayName,
    role: m.role,
    enabled: m.user.enabled,
    createdAt: m.user.createdAt,
  }));
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  password: string;
  role?: MembershipRole;
}

export async function createUser(ctx: DomainContext, input: CreateUserInput): Promise<{ userId: string }> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
  if (!ctx.organizationId) {
    throw new ForbiddenError();
  }

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const role = input.role ?? "STAFF";

  if (!email || !displayName) {
    throw new Error("Email and display name are required");
  }
  if (!isPasswordStrongEnough(input.password)) {
    throw new Error("Password must be at least 8 characters");
  }
  if (role === "OWNER") {
    throw new ForbiddenError("Cannot create another owner account");
  }

  await ensureDefaultOrganization();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await db.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      enabled: true,
      memberships: {
        create: {
          organizationId: ctx.organizationId,
          role,
        },
      },
    },
  });

  return { userId: user.id };
}

export async function setUserEnabled(
  ctx: DomainContext,
  userId: string,
  enabled: boolean,
): Promise<void> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
  if (!ctx.organizationId) {
    throw new ForbiddenError();
  }

  const membership = await db.organizationMembership.findFirst({
    where: { organizationId: ctx.organizationId, userId },
    include: { user: true },
  });

  if (!membership) {
    throw new Error("User not found");
  }
  if (membership.role === "OWNER" && !enabled) {
    throw new ForbiddenError("Cannot disable the owner account");
  }

  await db.user.update({
    where: { id: userId },
    data: { enabled },
  });

  if (!enabled) {
    await revokeAllSessionsForUser(userId);
  }
}

export async function resetUserPassword(
  ctx: DomainContext,
  userId: string,
  newPassword: string,
): Promise<void> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
  if (!ctx.organizationId) {
    throw new ForbiddenError();
  }

  if (!isPasswordStrongEnough(newPassword)) {
    throw new Error("Password must be at least 8 characters");
  }

  const membership = await db.organizationMembership.findFirst({
    where: { organizationId: ctx.organizationId, userId },
  });

  if (!membership) {
    throw new Error("User not found");
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  await revokeAllSessionsForUser(userId);
}

export async function updateUserRole(
  ctx: DomainContext,
  userId: string,
  role: MembershipRole,
): Promise<void> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
  if (!ctx.organizationId) {
    throw new ForbiddenError();
  }
  if (role === "OWNER") {
    throw new ForbiddenError("Cannot assign owner role");
  }

  const membership = await db.organizationMembership.findFirst({
    where: { organizationId: ctx.organizationId, userId },
  });

  if (!membership) {
    throw new Error("User not found");
  }
  if (membership.role === "OWNER") {
    throw new ForbiddenError("Cannot change owner role");
  }

  await db.organizationMembership.update({
    where: { id: membership.id },
    data: { role },
  });
}
