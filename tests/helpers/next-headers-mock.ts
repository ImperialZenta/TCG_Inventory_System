import { vi } from "vitest";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

/** Mutable cookie value for `next/headers` mocks in route handler tests. */
export const cookieStore = {
  sessionToken: undefined as string | undefined,
  setCalls: [] as { name: string; value: string; options?: unknown }[],
  deleteCalls: [] as string[],
};

export const headerStore = {
  pathname: "/",
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === SESSION_COOKIE_NAME && cookieStore.sessionToken) {
        return { value: cookieStore.sessionToken };
      }
      return undefined;
    },
    set: (name: string, value: string, options?: unknown) => {
      cookieStore.setCalls.push({ name, value, options });
      if (name === SESSION_COOKIE_NAME) {
        cookieStore.sessionToken = value;
      }
    },
    delete: (name: string) => {
      cookieStore.deleteCalls.push(name);
    },
  })),
  headers: vi.fn(async () => ({
    get: (key: string) => (key === "x-pathname" ? headerStore.pathname : null),
  })),
}));

export function clearMockCookies(): void {
  cookieStore.sessionToken = undefined;
  cookieStore.setCalls = [];
  cookieStore.deleteCalls = [];
  headerStore.pathname = "/";
}

export function setMockSessionCookie(token: string): void {
  cookieStore.sessionToken = token;
}
