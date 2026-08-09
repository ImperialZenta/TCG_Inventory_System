import { NextResponse } from "next/server";
import type { Permission } from "@/lib/auth/permissions";
import { requirePermissionContext } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import type { DomainContext } from "@/lib/context/domain-context";

export async function requireApiPermission(
  permission: Permission,
): Promise<
  | { ok: true; ctx: DomainContext }
  | { ok: false; response: NextResponse }
> {
  try {
    const ctx = await requirePermissionContext(permission, "api");
    return { ok: true, ctx };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    if (error instanceof ForbiddenError) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    throw error;
  }
}

/** @deprecated Prefer requireApiPermission for role-gated routes. */
export async function requireApiAuth(): Promise<
  | { ok: true; ctx: DomainContext }
  | { ok: false; response: NextResponse }
> {
  try {
    const { requireAuthContext } = await import("@/lib/context/domain-context");
    const ctx = await requireAuthContext("api");
    return { ok: true, ctx };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }
    throw error;
  }
}
