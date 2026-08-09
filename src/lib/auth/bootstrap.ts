import { db } from "@/lib/db";
import type { MembershipRole } from "@prisma/client";
import { hashPassword, isPasswordStrongEnough } from "./passwords";

const DEFAULT_ORG_SLUG = "default";

export async function hasAnyUser(): Promise<boolean> {
  const count = await db.user.count();
  return count > 0;
}

export async function getDefaultOrganization() {
  return db.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
}

export async function ensureDefaultOrganization(name = "Shop"): Promise<{ id: string }> {
  const org = await db.organization.upsert({
    where: { slug: DEFAULT_ORG_SLUG },
    update: {},
    create: { slug: DEFAULT_ORG_SLUG, name },
  });
  return { id: org.id };
}

export class BootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapError";
  }
}

export interface CreateInitialOwnerInput {
  email: string;
  displayName: string;
  password: string;
  organizationName?: string;
}

export async function createInitialOwner(input: CreateInitialOwnerInput): Promise<{ userId: string }> {
  if (await hasAnyUser()) {
    throw new BootstrapError("An owner account already exists");
  }

  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  if (!email || !displayName) {
    throw new BootstrapError("Email and display name are required");
  }
  if (!isPasswordStrongEnough(input.password)) {
    throw new BootstrapError("Password must be at least 8 characters");
  }

  const orgName = input.organizationName?.trim() || "Shop";
  const passwordHash = await hashPassword(input.password);

  const user = await db.$transaction(async (tx) => {
    const org = await tx.organization.upsert({
      where: { slug: DEFAULT_ORG_SLUG },
      update: { name: orgName },
      create: { slug: DEFAULT_ORG_SLUG, name: orgName },
    });

    const created = await tx.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        enabled: true,
        memberships: {
          create: {
            organizationId: org.id,
            role: "OWNER",
          },
        },
      },
    });

    return created;
  });

  return { userId: user.id };
}

export async function seedOwnerFromEnvIfConfigured(): Promise<void> {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const displayName = process.env.SEED_OWNER_NAME?.trim() || "Owner";

  if (!email || !password) {
    return;
  }

  if (await hasAnyUser()) {
    return;
  }

  await createInitialOwner({ email, displayName, password });
}

export type { MembershipRole };
