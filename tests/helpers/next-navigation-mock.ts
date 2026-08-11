import { vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT:${url}`), {
      digest: `NEXT_REDIRECT:${url}`,
    });
  }),
  usePathnameMock: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => navigationMocks.redirectMock(url),
  usePathname: () => navigationMocks.usePathnameMock(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

export const redirectMock = navigationMocks.redirectMock;
export const usePathnameMock = navigationMocks.usePathnameMock;

export function clearNavigationMocks(): void {
  redirectMock.mockClear();
  usePathnameMock.mockReturnValue("/");
}
