import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { transitionBlockStatus } from "@/lib/blocks/lifecycle";
import {
  MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL,
  MANAPOOL_DELIST_HONESTY_COPY,
  MANAPOOL_DELIST_PLAYBOOK_STEPS,
} from "@/lib/blocks/mana-pool-delist-playbook";
import { lifecycleBlockAction } from "@/app/blocks/actions";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

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

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({
    idleLabel,
    disabled,
  }: {
    idleLabel: string;
    disabled?: boolean;
  }) =>
    createElement(
      "button",
      { type: "submit", disabled: disabled ?? false },
      idleLabel,
    ),
}));

function buildLifecycleFormData(
  blockId: string,
  transition: string,
  confirmed?: boolean,
): FormData {
  const formData = new FormData();
  formData.set("blockId", blockId);
  formData.set("transition", transition);
  if (confirmed) {
    formData.set("confirmed", "true");
  }
  return formData;
}

describe("CHL-013 Take offline playbook UI", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("shows Mana Pool delist checklist for ACTIVE blocks on MANAPOOL", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl013@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: BlockDetailPage } = await import("@/app/blocks/[blockId]/page");
    const page = await BlockDetailPage({
      params: Promise.resolve({ blockId }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Manual Mana Pool delist required");
    expect(html).toContain(MANAPOOL_DELIST_HONESTY_COPY);
    for (const step of MANAPOOL_DELIST_PLAYBOOK_STEPS) {
      expect(html).toContain(step);
    }
    expect(html).toContain(MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL);
    expect(html).toContain('disabled=""');
  });

  it("does not show Mana Pool delist checklist for SEALED blocks", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl013-sealed@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);

    const { default: BlockDetailPage } = await import("@/app/blocks/[blockId]/page");
    const page = await BlockDetailPage({
      params: Promise.resolve({ blockId }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Take offline");
    expect(html).not.toContain("Manual Mana Pool delist required");
    expect(html).not.toContain(MANAPOOL_DELIST_ACKNOWLEDGMENT_LABEL);
  });
});

describe("CHL-013 Take offline action guard", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("rejects ACTIVE MANAPOOL archive without confirmation", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl013-guard@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);
    setMockSessionCookie(manager.token);

    const result = await lifecycleBlockAction(
      null,
      buildLifecycleFormData(blockId, "ARCHIVE"),
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Mana Pool manually/i);
  });

  it("archives ACTIVE MANAPOOL block when confirmed", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-chl013-confirm@test.local",
      role: "MANAGER",
    });

    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");

    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(manager.session);
    setMockSessionCookie(manager.token);

    const result = await lifecycleBlockAction(
      null,
      buildLifecycleFormData(blockId, "ARCHIVE", true),
    );

    expect(result.ok, result.message).toBe(true);
    expect(result.message).toMatch(/archived/i);

    const { db } = await import("@/lib/db");
    const block = await db.block.findUnique({ where: { blockId } });
    expect(block?.status).toBe("ARCHIVED");
  });
});
