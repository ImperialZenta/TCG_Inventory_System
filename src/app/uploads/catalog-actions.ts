"use server";

import { revalidatePath } from "next/cache";
import type { BlockChannel } from "@prisma/client";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import {
  assignBinToCatalog,
  createChannelCatalog,
  listChannelCatalogs,
  removeBinFromCatalog,
  updateChannelCatalogLabel,
} from "@/lib/channel-catalogs";
import { ChannelCatalogError } from "@/lib/channel-catalogs/errors";

export type CatalogActionResult =
  | { ok: true; message: string; catalogId?: string }
  | { ok: false; message: string };

function catalogErrorMessage(error: unknown): string {
  if (error instanceof ChannelCatalogError) return error.message;
  if (error instanceof ForbiddenError) return error.message;
  throw error;
}

function revalidateCatalogPaths() {
  revalidatePath("/catalogs");
  revalidatePath("/uploads/new");
}

export async function createChannelCatalogFormAction(
  _prev: CatalogActionResult | null,
  formData: FormData,
): Promise<CatalogActionResult> {
  const channel = (formData.get("channel") as string)?.trim() as BlockChannel;
  const label = (formData.get("label") as string)?.trim() ?? "";
  const result = await createChannelCatalogAction(channel, label);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function assignBinToCatalogFormAction(
  _prev: CatalogActionResult | null,
  formData: FormData,
): Promise<CatalogActionResult> {
  const catalogId = (formData.get("catalogId") as string)?.trim() ?? "";
  const binId = (formData.get("binId") as string)?.trim() ?? "";
  const result = await assignBinToCatalogAction(catalogId, binId);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function removeBinFromCatalogFormAction(
  _prev: CatalogActionResult | null,
  formData: FormData,
): Promise<CatalogActionResult> {
  const catalogId = (formData.get("catalogId") as string)?.trim() ?? "";
  const binId = (formData.get("binId") as string)?.trim() ?? "";
  const result = await removeBinFromCatalogAction(catalogId, binId);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function renameChannelCatalogFormAction(
  _prev: CatalogActionResult | null,
  formData: FormData,
): Promise<CatalogActionResult> {
  const catalogId = (formData.get("catalogId") as string)?.trim() ?? "";
  const label = (formData.get("label") as string)?.trim() ?? "";
  const result = await renameChannelCatalogAction(catalogId, label);
  if (result.ok) revalidateCatalogPaths();
  return result;
}

export async function createChannelCatalogAction(
  channel: BlockChannel,
  label: string,
): Promise<CatalogActionResult> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    const result = await createChannelCatalog(ctx, channel, label);
    return {
      ok: true,
      message: `Created ${label}`,
      catalogId: result.id,
    };
  } catch (error) {
    return { ok: false, message: catalogErrorMessage(error) };
  }
}

export async function assignBinToCatalogAction(
  catalogId: string,
  binId: string,
): Promise<CatalogActionResult> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    const result = await assignBinToCatalog(ctx, catalogId, binId);
    return {
      ok: true,
      message: `Assigned bin ${result.binDisplayId} to catalog`,
      catalogId: result.catalogId,
    };
  } catch (error) {
    return { ok: false, message: catalogErrorMessage(error) };
  }
}

export async function removeBinFromCatalogAction(
  catalogId: string,
  binId: string,
): Promise<CatalogActionResult> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    const result = await removeBinFromCatalog(ctx, catalogId, binId);
    return {
      ok: true,
      message: `Removed bin ${result.binDisplayId} from catalog`,
      catalogId: result.catalogId,
    };
  } catch (error) {
    return { ok: false, message: catalogErrorMessage(error) };
  }
}

export async function renameChannelCatalogAction(
  catalogId: string,
  label: string,
): Promise<CatalogActionResult> {
  try {
    const ctx = await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    const result = await updateChannelCatalogLabel(ctx, catalogId, label);
    return {
      ok: true,
      message: `Renamed catalog to ${result.label}`,
      catalogId: result.id,
    };
  } catch (error) {
    return { ok: false, message: catalogErrorMessage(error) };
  }
}

export async function listChannelCatalogsAction(
  channel?: BlockChannel,
): Promise<
  | { ok: true; catalogs: Awaited<ReturnType<typeof listChannelCatalogs>> }
  | { ok: false; message: string }
> {
  try {
    await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    const catalogs = await listChannelCatalogs(channel);
    return { ok: true, catalogs };
  } catch (error) {
    return { ok: false, message: catalogErrorMessage(error) };
  }
}

/** Permission gate for channel catalog configuration (CHL-001). */
export async function configureCatalogAccessAction(): Promise<CatalogActionResult> {
  try {
    await requirePermissionContext(PERMISSIONS.CATALOG_CONFIGURE);
    return { ok: true, message: "Catalog configuration permitted" };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
