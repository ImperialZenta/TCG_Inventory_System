import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./constants";
import { validateSessionToken, type ValidatedSession } from "./sessions";

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE_NAME)?.value?.trim();
  return value || null;
}

export async function getCurrentSession(): Promise<ValidatedSession | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return null;
  }
  return validateSessionToken(token);
}
