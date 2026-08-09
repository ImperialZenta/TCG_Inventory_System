import type { MembershipRole } from "@prisma/client";

export const SESSION_COOKIE_NAME = "tcg_session";

/** Default session lifetime (30 days). ACC-004 may shorten per device later. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieOptions(maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
  READ_ONLY: "Read-only",
};

export const ASSIGNABLE_ROLES: MembershipRole[] = ["MANAGER", "STAFF", "READ_ONLY"];
