"use server";

import { revalidatePath } from "next/cache";
import type { MembershipRole } from "@prisma/client";
import { requireAuthContext } from "@/lib/context/domain-context";
import {
  createUser,
  listUsers,
  resetUserPassword,
  setUserEnabled,
  updateUserRole,
  ForbiddenError,
} from "@/lib/auth";

export type UsersActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

function actionError(error: unknown): UsersActionResult {
  if (error instanceof ForbiddenError) {
    return { ok: false, message: error.message };
  }
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Action failed",
  };
}

export async function createUserAction(
  _prev: UsersActionResult | null,
  formData: FormData,
): Promise<UsersActionResult> {
  try {
    const ctx = await requireAuthContext();
    const role = (formData.get("role") as MembershipRole) || "STAFF";
    await createUser(ctx, {
      email: (formData.get("email") as string) ?? "",
      displayName: (formData.get("displayName") as string) ?? "",
      password: (formData.get("password") as string) ?? "",
      role,
    });
    revalidatePath("/settings/users");
    return { ok: true, message: "User created" };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleUserEnabledAction(userId: string, enabled: boolean): Promise<UsersActionResult> {
  try {
    const ctx = await requireAuthContext();
    await setUserEnabled(ctx, userId, enabled);
    revalidatePath("/settings/users");
    return { ok: true, message: enabled ? "User enabled" : "User disabled" };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetUserPasswordAction(
  _prev: UsersActionResult | null,
  formData: FormData,
): Promise<UsersActionResult> {
  try {
    const ctx = await requireAuthContext();
    const userId = (formData.get("userId") as string)?.trim();
    const password = (formData.get("password") as string) ?? "";
    if (!userId) {
      return { ok: false, message: "User is required" };
    }
    await resetUserPassword(ctx, userId, password);
    revalidatePath("/settings/users");
    return { ok: true, message: "Password reset" };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleUserEnabledFormAction(formData: FormData): Promise<void> {
  const userId = (formData.get("userId") as string)?.trim();
  const enabled = formData.get("enabled") === "true";
  if (!userId) {
    return;
  }
  await toggleUserEnabledAction(userId, enabled);
}

export async function updateUserRoleAction(userId: string, role: MembershipRole): Promise<UsersActionResult> {
  try {
    const ctx = await requireAuthContext();
    await updateUserRole(ctx, userId, role);
    revalidatePath("/settings/users");
    return { ok: true, message: "Role updated" };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateUserRoleFormAction(formData: FormData): Promise<void> {
  const userId = (formData.get("userId") as string)?.trim();
  const role = formData.get("role") as MembershipRole;
  if (!userId || !role) {
    return;
  }
  await updateUserRoleAction(userId, role);
}

export async function getUsersForOwnerPage() {
  const ctx = await requireAuthContext();
  return listUsers(ctx);
}
