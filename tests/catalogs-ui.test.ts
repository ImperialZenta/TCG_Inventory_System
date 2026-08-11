import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { createChannelCatalog, getCatalogWithBins } from "@/lib/channel-catalogs";
import { listEligibleUploadBlocks } from "@/lib/upload-sessions";
import {
  assignBinToCatalogAction,
  createChannelCatalogAction,
} from "@/app/uploads/catalog-actions";
import { BLOCK_CHANNEL_LABELS, navItemsForRole } from "@/lib/constants";
import {
  clearMockCookies,
  setMockSessionCookie,
} from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));

vi.mock("@/app/uploads/actions", () => ({
  createUploadSessionAction: vi.fn(),
}));

describe("CHL-008 catalogs nav", () => {
  it("shows Catalogs for manager but not staff", () => {
    expect(navItemsForRole("MANAGER").map((item) => item.href)).toContain("/catalogs");
    expect(navItemsForRole("STAFF").map((item) => item.href)).not.toContain("/catalogs");
  });
});

describe("CHL-008 catalogs page UI", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lists catalog membership with sealed block counts", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-catalogs@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 2);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);

    const catalog = await createChannelCatalog(
      TEST_CONTEXT,
      "MANAPOOL",
      "Mana Pool — Shelf A",
    );
    await import("@/lib/channel-catalogs").then(({ assignBinToCatalog }) =>
      assignBinToCatalog(TEST_CONTEXT, catalog.id, binId),
    );

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: CatalogsPage } = await import("@/app/catalogs/page");
    const page = await CatalogsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Channel catalogs");
    expect(html).toContain("Mana Pool — Shelf A");
    expect(html).toContain(BLOCK_CHANNEL_LABELS.MANAPOOL);
    expect(html).toContain("TEST-A-B01");
    expect(html).toContain("(2 sealed)");
    expect(html).toContain("2 sealed blocks");
    expect(html).toContain("Create catalog");
  });
});

describe("CHL-008 upload session catalog filter", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("listEligibleUploadBlocks returns only blocks in catalog member bins", async () => {
    const { binId } = await resetTestDb();
    const shelf = await db.shelf.findFirst();
    const otherBin = await db.bin.create({
      data: {
        binId: "TEST-A-B02",
        shelfId: shelf!.id,
        label: "Other bin",
        sortOrder: 2,
      },
    });

    const catalogBinFixture = await createFormalizedImport(binId, 2);
    const otherBinFixture = await createFormalizedImport(otherBin.id, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [
      ...catalogBinFixture.internalIds,
      ...otherBinFixture.internalIds,
    ]);

    const catalog = await createChannelCatalog(
      TEST_CONTEXT,
      "MANAPOOL",
      "Mana Pool — Shelf A",
    );
    await import("@/lib/channel-catalogs").then(({ assignBinToCatalog }) =>
      assignBinToCatalog(TEST_CONTEXT, catalog.id, binId),
    );

    const filtered = await listEligibleUploadBlocks(catalog.id);
    const allEligible = await listEligibleUploadBlocks();

    expect(filtered.map((b) => b.blockId).sort()).toEqual(
      catalogBinFixture.blockIds.sort(),
    );
    expect(allEligible.map((b) => b.blockId).sort()).toEqual(
      [...catalogBinFixture.blockIds, ...otherBinFixture.blockIds].sort(),
    );
  });

  it("new upload session page shows only catalog-filtered blocks", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-upload-filter@test.local",
      role: "STAFF",
    });

    const shelf = await db.shelf.findFirst();
    const otherBin = await db.bin.create({
      data: {
        binId: "TEST-A-B02",
        shelfId: shelf!.id,
        label: "Other bin",
        sortOrder: 2,
      },
    });

    const catalogBinFixture = await createFormalizedImport(binId, 1);
    const otherBinFixture = await createFormalizedImport(otherBin.id, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [
      ...catalogBinFixture.internalIds,
      ...otherBinFixture.internalIds,
    ]);

    const catalog = await createChannelCatalog(
      TEST_CONTEXT,
      "MANAPOOL",
      "Mana Pool — Shelf A",
    );
    await import("@/lib/channel-catalogs").then(({ assignBinToCatalog }) =>
      assignBinToCatalog(TEST_CONTEXT, catalog.id, binId),
    );

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staff.session);

    const { default: NewUploadSessionPage } = await import("@/app/uploads/new/page");
    const page = await NewUploadSessionPage({
      searchParams: Promise.resolve({ catalogId: catalog.id }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain(catalogBinFixture.blockIds[0]!);
    expect(html).not.toContain(otherBinFixture.blockIds[0]!);
    expect(html).toContain("Create session (0 blocks)");
  });
});

describe("CHL-008 catalog form actions", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("assigns a bin through assignBinToCatalogAction", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-catalog-action@test.local",
      role: "MANAGER",
    });
    setMockSessionCookie(manager.token);

    const created = await createChannelCatalogAction("MANAPOOL", "Mana Pool — Shelf A");
    expect(created.ok).toBe(true);
    expect(created.catalogId).toBeTruthy();

    const assigned = await assignBinToCatalogAction(created.catalogId!, binId);
    expect(assigned.ok).toBe(true);

    const detail = await getCatalogWithBins(created.catalogId!);
    expect(detail?.bins.map((b) => b.binDisplayId)).toContain("TEST-A-B01");
  });
});
