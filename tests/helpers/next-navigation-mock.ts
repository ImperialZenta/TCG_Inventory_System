import { vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  usePathnameMock: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => navigationMocks.redirectMock(url),
  usePathname: () => navigationMocks.usePathnameMock(),
}));

export const redirectMock = navigationMocks.redirectMock;
export const usePathnameMock = navigationMocks.usePathnameMock;

export function clearNavigationMocks(): void {
  redirectMock.mockClear();
  usePathnameMock.mockReturnValue("/");
}
