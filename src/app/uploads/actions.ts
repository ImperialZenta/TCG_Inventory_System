"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { BlockChannel } from "@prisma/client";
import { ForbiddenError } from "@/lib/auth/errors";
import { PERMISSIONS, requirePermissionContext } from "@/lib/auth/permissions";
import {
  cancelUploadSession,
  completeUploadSession,
  createUploadSession,
  generateUploadSessionCsv,
  UploadSessionError,
} from "@/lib/upload-sessions";

export type UploadActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function createUploadSessionAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const channel = (formData.get("channel") as string)?.trim() as BlockChannel;
  const blockIds = formData.getAll("blockIds").map((v) => String(v).trim()).filter(Boolean);

  if (!channel) {
    return { ok: false, message: "Select a marketplace channel" };
  }

  if (blockIds.length === 0) {
    return { ok: false, message: "Select at least one sealed block" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.UPLOAD_SESSION_CREATE);
    const result = await createUploadSession(ctx, blockIds, channel);
    revalidatePath("/uploads");
    revalidatePath("/blocks");
    redirect(`/uploads/${result.sessionId}`);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof UploadSessionError) {
      return { ok: false, message: error.message };
    }
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return { ok: false, message: "Could not create upload session" };
  }
}

export async function generateUploadSessionCsvAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const sessionId = (formData.get("sessionId") as string)?.trim();
  if (!sessionId) {
    return { ok: false, message: "Session not found" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.UPLOAD_SESSION_CREATE);
    const result = await generateUploadSessionCsv(ctx, sessionId);
    revalidatePath(`/uploads/${sessionId}`);
    revalidatePath("/uploads");
    return {
      ok: true,
      message: `Generated CSV with ${result.rowCount} row${result.rowCount === 1 ? "" : "s"}`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof UploadSessionError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "CSV generation failed" };
  }
}

export async function completeUploadSessionAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const sessionId = (formData.get("sessionId") as string)?.trim();
  const confirmed = (formData.get("confirmed") as string)?.trim() === "true";

  if (!sessionId) {
    return { ok: false, message: "Session not found" };
  }

  if (!confirmed) {
    return { ok: false, message: "Confirmation required" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.UPLOAD_SESSION_COMPLETE);
    const result = await completeUploadSession(ctx, sessionId);
    revalidatePath(`/uploads/${sessionId}`);
    revalidatePath("/uploads");
    revalidatePath("/blocks");
    return {
      ok: true,
      message: `Completed ${result.sessionId} — ${result.mtgBlockIds.length} block${result.mtgBlockIds.length === 1 ? "" : "s"} are now active`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof UploadSessionError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Complete failed" };
  }
}

export async function cancelUploadSessionAction(
  _prev: UploadActionResult | null,
  formData: FormData,
): Promise<UploadActionResult> {
  const sessionId = (formData.get("sessionId") as string)?.trim();
  if (!sessionId) {
    return { ok: false, message: "Session not found" };
  }

  try {
    const ctx = await requirePermissionContext(PERMISSIONS.UPLOAD_SESSION_CREATE);
    const result = await cancelUploadSession(ctx, sessionId);
    revalidatePath(`/uploads/${sessionId}`);
    revalidatePath("/uploads");
    revalidatePath("/blocks");
    return {
      ok: true,
      message: `Cancelled ${result.sessionId} — reservations released`,
    };
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return { ok: false, message: error.message };
    }
    if (error instanceof UploadSessionError) {
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Cancel failed" };
  }
}
