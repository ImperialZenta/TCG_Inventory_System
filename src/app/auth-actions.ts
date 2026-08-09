"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authenticate,
  createInitialOwner,
  createSession,
  INVALID_CREDENTIALS_MESSAGE,
  revokeSessionByToken,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  getSessionTokenFromCookies,
  BootstrapError,
} from "@/lib/auth";

export type AuthActionResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function safeCallbackUrl(raw: FormDataEntryValue | null): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  if (value.startsWith("/login") || value.startsWith("/setup")) {
    return "/";
  }
  return value;
}

export async function signInAction(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = (formData.get("email") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));

  const user = await authenticate(email, password);
  if (!user) {
    return { ok: false, message: INVALID_CREDENTIALS_MESSAGE };
  }

  const { token } = await createSession(user.userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  redirect(callbackUrl);
}

export async function setupOwnerAction(
  _prev: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = (formData.get("email") as string) ?? "";
  const displayName = (formData.get("displayName") as string) ?? "";
  const password = (formData.get("password") as string) ?? "";
  const confirm = (formData.get("confirmPassword") as string) ?? "";
  const shopName = (formData.get("shopName") as string) ?? "";

  if (password !== confirm) {
    return { ok: false, message: "Passwords do not match" };
  }

  try {
    const { userId } = await createInitialOwner({
      email,
      displayName,
      password,
      organizationName: shopName || undefined,
    });

    const { token } = await createSession(userId);
    const jar = await cookies();
    jar.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

    redirect("/");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    const message =
      error instanceof BootstrapError || error instanceof Error
        ? error.message
        : "Setup failed";
    return { ok: false, message };
  }
}

export async function signOutAction(): Promise<void> {
  const token = await getSessionTokenFromCookies();
  if (token) {
    await revokeSessionByToken(token);
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
