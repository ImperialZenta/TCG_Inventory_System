import type { MembershipRole } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { requireAuthContext } from "@/lib/context/domain-context";
import { ForbiddenError } from "./errors";
import { logPermissionRefusal } from "./log-permission-refusal";
export const PERMISSIONS = {
  DANGER_ZONE: "danger_zone",
  USER_MANAGEMENT: "user_management",
  BACKUP_EXPORT: "backup_export",
  BLOCK_REMOVE: "block_remove",
  BLOCK_LIFECYCLE: "block_lifecycle",
  SETTINGS_STRUCTURE: "settings_structure",
  STAGING_DELETE: "staging_delete",
  STAGING_UNDO: "staging_undo",
  PRICING_BACKFILL: "pricing_backfill",
  ORDER_IMPORT: "order_import",
  STAGING_INTAKE: "staging_intake",
  BLOCK_MOVE: "block_move",
  BLOCK_SEAL: "block_seal",
  PICK_OPERATIONS: "pick_operations",
  GENERATE_PICK_LIST: "generate_pick_list",
  UPLOAD_SESSION_CREATE: "upload_session_create",
  UPLOAD_SESSION_COMPLETE: "upload_session_complete",
  CATALOG_CONFIGURE: "catalog_configure",
  STOCK_ADJUST: "stock_adjust",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const PERMISSION_MATRIX: Record<Permission, MembershipRole[]> = {
  [PERMISSIONS.DANGER_ZONE]: ["OWNER"],
  [PERMISSIONS.USER_MANAGEMENT]: ["OWNER"],
  [PERMISSIONS.BACKUP_EXPORT]: ["OWNER"],
  [PERMISSIONS.BLOCK_REMOVE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.BLOCK_LIFECYCLE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.SETTINGS_STRUCTURE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.STAGING_DELETE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.STAGING_UNDO]: ["OWNER", "MANAGER"],
  [PERMISSIONS.PRICING_BACKFILL]: ["OWNER", "MANAGER"],
  [PERMISSIONS.ORDER_IMPORT]: ["OWNER", "MANAGER"],
  [PERMISSIONS.STAGING_INTAKE]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.BLOCK_MOVE]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.BLOCK_SEAL]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.PICK_OPERATIONS]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.GENERATE_PICK_LIST]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.UPLOAD_SESSION_CREATE]: ["OWNER", "MANAGER", "STAFF"],
  [PERMISSIONS.UPLOAD_SESSION_COMPLETE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.CATALOG_CONFIGURE]: ["OWNER", "MANAGER"],
  [PERMISSIONS.STOCK_ADJUST]: ["OWNER", "MANAGER", "STAFF"],
};

export function canPerform(ctx: DomainContext, permission: Permission): boolean {
  if (!ctx.role) {
    return false;
  }
  return PERMISSION_MATRIX[permission].includes(ctx.role);
}

export function roleCanPerform(role: MembershipRole | null, permission: Permission): boolean {
  if (!role) {
    return false;
  }
  return PERMISSION_MATRIX[permission].includes(role);
}

export async function requirePermission(ctx: DomainContext, permission: Permission): Promise<void> {
  if (canPerform(ctx, permission)) {
    return;
  }
  await logPermissionRefusal(ctx, permission);
  throw new ForbiddenError("Not permitted");
}

export async function requireOwner(ctx: DomainContext): Promise<void> {
  await requirePermission(ctx, PERMISSIONS.USER_MANAGEMENT);
}

export function requireRole(ctx: DomainContext, allowed: MembershipRole[]): void {
  if (!ctx.role || !allowed.includes(ctx.role)) {
    throw new ForbiddenError("Not permitted");
  }
}

export async function requirePermissionContext(
  permission: Permission,
  source: DomainContext["source"] = "ui",
): Promise<DomainContext> {
  const ctx = await requireAuthContext(source);
  await requirePermission(ctx, permission);
  return ctx;
}