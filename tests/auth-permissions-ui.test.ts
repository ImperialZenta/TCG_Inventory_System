import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppNav } from "@/components/app-nav";
import { navItemsForRole } from "@/lib/constants";
import { truncateAuthTables, createTestOwner, createTestUserWithSession } from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

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

vi.mock("@/lib/staging/defaults", () => ({
  getDefaultFormalizeBinId: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/app/settings/suggested-ids", () => ({
  SuggestedIds: () => createElement("div", { "data-testid": "suggested-ids" }),
}));
vi.mock("@/app/settings/target-count-form", () => ({
  TargetCountForm: () => createElement("div", { "data-testid": "target-count-form" }),
}));
vi.mock("@/app/settings/default-bin-form", () => ({
  DefaultBinForm: () => createElement("div", { "data-testid": "default-bin-form" }),
}));
vi.mock("@/app/settings/add-shelf-form", () => ({
  AddShelfForm: () => createElement("div", { "data-testid": "add-shelf-form" }),
}));
vi.mock("@/app/settings/add-bin-form", () => ({
  AddBinForm: () => createElement("div", { "data-testid": "add-bin-form" }),
}));
vi.mock("@/app/settings/backfill-prices-form", () => ({
  BackfillPricesForm: () => createElement("div", { "data-testid": "backfill-prices-form" }),
}));
vi.mock("@/app/settings/staff-accounts-link", () => ({
  StaffAccountsLink: () => null,
}));
vi.mock("@/components/restore-backup-form", () => ({
  RestoreBackupForm: () => createElement("div", { "data-testid": "restore-backup-form" }),
}));

describe("ACC-002 role-gated nav", () => {
  it("hides operational routes for read-only", () => {
    const hrefs = navItemsForRole("READ_ONLY").map((item) => item.href);
    expect(hrefs).not.toContain("/staging");
    expect(hrefs).not.toContain("/orders");
    expect(hrefs).not.toContain("/pick");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).toContain("/inventory");
  });

  it("shows full nav for owner", () => {
    const hrefs = navItemsForRole("OWNER").map((item) => item.href);
    expect(hrefs).toContain("/staging");
    expect(hrefs).toContain("/settings");
  });

  it("AppNav omits Settings link for read-only", () => {
    const html = renderToStaticMarkup(
      createElement(AppNav, { displayName: "Reader", role: "READ_ONLY" }),
    );
    expect(html).not.toContain('href="/settings"');
    expect(html).not.toContain('href="/staging"');
    expect(html).toContain('href="/inventory"');
  });

  it("AppNav includes Settings link for owner", () => {
    const html = renderToStaticMarkup(
      createElement(AppNav, { displayName: "Owner", role: "OWNER" }),
    );
    expect(html).toContain('href="/settings"');
  });
});

describe("ACC-002 role-gated settings page markup", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("staff settings omit danger zone and structure forms", async () => {
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      role: "STAFF",
    });
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staff.session);

    const { default: SettingsPage } = await import("@/app/settings/page");
    const page = await SettingsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).not.toContain("Danger zone");
    expect(html).not.toContain("data-testid=\"add-shelf-form\"");
    expect(html).not.toContain("data-testid=\"backfill-prices-form\"");
    expect(html).toContain("Bin utilization");
  });

  it("manager settings include structure forms but omit danger zone and backup download", async () => {
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-settings@test.local",
      role: "MANAGER",
    });
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: SettingsPage } = await import("@/app/settings/page");
    const page = await SettingsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("data-testid=\"add-shelf-form\"");
    expect(html).toContain("data-testid=\"add-bin-form\"");
    expect(html).toContain("data-testid=\"backfill-prices-form\"");
    expect(html).not.toContain("Danger zone");
    expect(html).not.toContain("Download backup JSON");
    expect(html).not.toContain("data-testid=\"restore-backup-form\"");
  });

  it("owner settings include danger zone and structure forms", async () => {
    const owner = await createTestOwner();
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(owner.session);

    const { default: SettingsPage } = await import("@/app/settings/page");
    const page = await SettingsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Danger zone");
    expect(html).toContain("data-testid=\"add-shelf-form\"");
    expect(html).toContain("Download backup JSON");
  });
});

describe("ACC-002 role-gated block detail markup", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("staff block detail omits remove and lifecycle sections", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      role: "STAFF",
    });
    const fixture = await createFormalizedImport(binId, 1);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staff.session);

    const { default: BlockDetailPage } = await import("@/app/blocks/[blockId]/page");
    const page = await BlockDetailPage({
      params: Promise.resolve({ blockId: fixture.blockIds[0]! }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).not.toContain("Remove block");
    expect(html).toContain("Move block");
  });

  it("manager block detail includes remove section", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-block@test.local",
      role: "MANAGER",
    });
    const fixture = await createFormalizedImport(binId, 1);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: BlockDetailPage } = await import("@/app/blocks/[blockId]/page");
    const page = await BlockDetailPage({
      params: Promise.resolve({ blockId: fixture.blockIds[0]! }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Remove block");
  });
});
