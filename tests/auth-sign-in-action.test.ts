import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { redirectMock } from "./helpers/next-navigation-mock";
import { cookieStore } from "./helpers/next-headers-mock";
import { signInAction, setupOwnerAction } from "@/app/auth-actions";
import { createInitialOwner, hasAnyUser } from "@/lib/auth/bootstrap";
import { truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

describe("signInAction", () => {
  beforeEach(async () => {
    redirectMock.mockClear();
    cookieStore.setCalls = [];
    cookieStore.sessionToken = undefined;
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("sets session cookie and redirects to callbackUrl on success", async () => {
    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Andrew",
      password: "password123",
    });

    const formData = new FormData();
    formData.set("email", "owner@test.local");
    formData.set("password", "password123");
    formData.set("callbackUrl", "/inventory");

    await expect(signInAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:/inventory");

    expect(cookieStore.setCalls).toHaveLength(1);
    expect(cookieStore.setCalls[0]?.name).toBe(SESSION_COOKIE_NAME);
    expect(cookieStore.setCalls[0]?.value).toBeTruthy();
    expect(redirectMock).toHaveBeenCalledWith("/inventory");
  });

  it("returns generic error without setting cookie on bad password", async () => {
    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Andrew",
      password: "password123",
    });

    const formData = new FormData();
    formData.set("email", "owner@test.local");
    formData.set("password", "wrong");
    formData.set("callbackUrl", "/");

    const result = await signInAction(null, formData);
    expect(result).toEqual({ ok: false, message: "Invalid email or password" });
    expect(cookieStore.setCalls).toHaveLength(0);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("setupOwnerAction", () => {
  beforeEach(async () => {
    redirectMock.mockClear();
    cookieStore.setCalls = [];
    cookieStore.sessionToken = undefined;
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates owner, sets session cookie, and redirects home", async () => {
    const formData = new FormData();
    formData.set("email", "owner@test.local");
    formData.set("displayName", "Andrew");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");
    formData.set("shopName", "Shop");

    await expect(setupOwnerAction(null, formData)).rejects.toThrow("NEXT_REDIRECT:/");

    expect(await hasAnyUser()).toBe(true);
    expect(cookieStore.setCalls).toHaveLength(1);
    expect(cookieStore.setCalls[0]?.name).toBe(SESSION_COOKIE_NAME);
    expect(cookieStore.setCalls[0]?.value).toBeTruthy();
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("returns error when passwords do not match", async () => {
    const formData = new FormData();
    formData.set("email", "owner@test.local");
    formData.set("displayName", "Andrew");
    formData.set("password", "password123");
    formData.set("confirmPassword", "different");
    formData.set("shopName", "Shop");

    const result = await setupOwnerAction(null, formData);
    expect(result).toEqual({ ok: false, message: "Passwords do not match" });
    expect(await hasAnyUser()).toBe(false);
    expect(cookieStore.setCalls).toHaveLength(0);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
