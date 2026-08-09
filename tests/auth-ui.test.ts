import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { headerStore } from "./helpers/next-headers-mock";
import { redirectMock, usePathnameMock } from "./helpers/next-navigation-mock";
import { AppNav } from "@/components/app-nav";
import { sessionToNavProps } from "@/components/app-nav-shell";
import { SessionGate } from "@/components/session-gate";

vi.mock("@/app/auth-actions", () => ({
  signOutAction: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("auth UI wiring", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    headerStore.pathname = "/";
    usePathnameMock.mockReturnValue("/");
  });

  it("renders signed-in display name and Sign out in AppNav markup", () => {
    const html = renderToStaticMarkup(
      createElement(AppNav, { displayName: "Andrew", role: "OWNER" }),
    );

    expect(html).toContain("Andrew");
    expect(html).toContain("Sign out");
    expect(html).toContain("Owner");
  });

  it("maps session displayName to nav props for AppNavShell", () => {
    const props = sessionToNavProps({
      sessionId: "sess-1",
      userId: "user-1",
      email: "owner@test.local",
      displayName: "Andrew",
      enabled: true,
      organizationId: "org-1",
      role: "OWNER",
    });

    expect(props.displayName).toBe("Andrew");
    expect(props.role).toBe("OWNER");
  });

  it("SessionGate redirects unauthenticated app routes before rendering children", async () => {
    headerStore.pathname = "/inventory";
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(null);

    await expect(
      SessionGate({ children: createElement("div", null, "secret inventory") }),
    ).rejects.toThrow("NEXT_REDIRECT:/login?callbackUrl=%2Finventory");

    expect(redirectMock).toHaveBeenCalledWith("/login?callbackUrl=%2Finventory");
  });

  it("SessionGate allows auth pages without a session", async () => {
    headerStore.pathname = "/login";

    const result = await SessionGate({
      children: createElement("div", null, "login form"),
    });

    expect(renderToStaticMarkup(result as ReactElement)).toContain("login form");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
