import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { moveBlockToBin } from "@/lib/blocks/move";
import { createUploadSession } from "@/lib/upload-sessions";
import {
  assignBinToCatalog,
  createChannelCatalog,
  removeBinFromCatalog,
} from "@/lib/channel-catalogs";
import {
  clearMockCookies,
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

vi.mock("@/app/blocks/counter-pick-form", () => ({
  CounterPickForm: () => null,
}));

vi.mock("@/app/uploads/actions", () => ({
  generateUploadSessionCsvAction: vi.fn(),
  completeUploadSessionAction: vi.fn(),
  cancelUploadSessionAction: vi.fn(),
}));

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));

describe("CHL-015 block detail UI — reserved session", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("hides Mark as listed and shows reserved session id", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl015@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: BlockDetailPage } = await import("@/app/blocks/[blockId]/page");
    const page = await BlockDetailPage({
      params: Promise.resolve({ blockId: fixture.blockIds[0]! }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Reserved in upload session");
    expect(html).toContain(created.sessionId);
    expect(html).toContain(`href="/uploads/${created.sessionId}"`);
    expect(html).not.toContain("Mark as listed");
    expect(html).toContain("per-block activation is disabled");
  });
});

describe("CHL-015 upload session detail UI — location after move", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("shows updated location after moveBlockToBin", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl015-session@test.local",
      role: "MANAGER",
    });

    const shelf = await db.shelf.findFirst();
    const secondBin = await db.bin.create({
        data: {
          binId: "TEST-A-B02",
          shelfId: shelf!.id,
          label: "Second bin",
          sortOrder: 2,
      },
    });

    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await moveBlockToBin(TEST_CONTEXT, fixture.blockIds[0]!, secondBin.id);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: UploadSessionPage } = await import("@/app/uploads/[sessionId]/page");
    const page = await UploadSessionPage({
      params: Promise.resolve({ sessionId: created.sessionId }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain(fixture.blockIds[0]!);
    expect(html).toContain("TEST-A / TEST-A-B02");
    expect(html).not.toContain("TEST-A / TEST-A-B01");
  });
});

describe("CHL-015 upload session detail UI — catalog drift (I-08)", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("shows catalog drift warning when bin is removed from catalog mid-session", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl015-drift@test.local",
      role: "MANAGER",
    });

    const catalog = await createChannelCatalog(TEST_CONTEXT, "MANAPOOL", "Mana Pool — Shelf A");
    await assignBinToCatalog(TEST_CONTEXT, catalog.id, binId);

    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
    const created = await createUploadSession(
      TEST_CONTEXT,
      [fixture.internalIds[0]!],
      "MANAPOOL",
    );

    await removeBinFromCatalog(TEST_CONTEXT, catalog.id, binId);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: UploadSessionPage } = await import("@/app/uploads/[sessionId]/page");
    const page = await UploadSessionPage({
      params: Promise.resolve({ sessionId: created.sessionId }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Catalog location drift");
    expect(html).toContain(fixture.blockIds[0]!);
    expect(html).toContain("not in a catalog for this session");
  });
});
