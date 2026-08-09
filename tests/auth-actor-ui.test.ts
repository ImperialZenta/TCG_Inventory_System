import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { truncateAuthTables, createTestOwner } from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { sessionToDomainContext } from "@/lib/context/domain-context";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe("ACC-003 activity feed UI", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("renders Who column with the acting user display name", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner({ displayName: "Gate Owner" });
    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(sessionToDomainContext(owner.session, "ui"), [
      fixture.internalIds[0]!,
    ]);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(owner.session);

    const { default: ActivityPage } = await import("@/app/activity/page");
    const page = await ActivityPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Who");
    expect(html).toContain("Gate Owner");
    expect(html).toContain("Block sealed");
  });
});
