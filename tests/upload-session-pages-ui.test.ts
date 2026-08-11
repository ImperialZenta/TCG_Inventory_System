import "./helpers/next-navigation-mock";
import "./helpers/next-headers-mock";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLOCK_CHANNEL_LABELS,
  UPLOAD_SESSION_STATUS_LABELS,
} from "@/lib/constants";

vi.mock("@/app/uploads/actions", () => ({
  generateUploadSessionCsvAction: vi.fn(),
  completeUploadSessionAction: vi.fn(),
  cancelUploadSessionAction: vi.fn(),
}));

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

vi.mock("@/lib/upload-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/upload-sessions")>();
  return {
    ...actual,
    listUploadSessions: vi.fn(),
    getUploadSessionDetail: vi.fn(),
  };
});

const staffSession = {
  sessionId: "staff-session",
  userId: "staff-id",
  email: "staff@test.local",
  displayName: "Staff",
  enabled: true,
  organizationId: "org-id",
  role: "STAFF" as const,
};

const managerSession = {
  ...staffSession,
  sessionId: "manager-session",
  userId: "manager-id",
  email: "manager@test.local",
  displayName: "Manager",
  role: "MANAGER" as const,
};

describe("CHL-007 upload sessions list page", () => {
  beforeEach(async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(staffSession);

    const { listUploadSessions } = await import("@/lib/upload-sessions");
    vi.mocked(listUploadSessions).mockResolvedValue([
      {
        id: "session-1",
        sessionId: "UP-0001",
        channel: "MANAPOOL",
        status: "CSV_READY",
        blockCount: 2,
        createdAt: new Date("2026-08-10T10:00:00Z"),
        csvGeneratedAt: new Date("2026-08-10T11:00:00Z"),
        completedAt: null,
      },
      {
        id: "session-2",
        sessionId: "UP-0002",
        channel: "MANAPOOL",
        status: "DRAFT",
        blockCount: 3,
        createdAt: new Date("2026-08-10T09:00:00Z"),
        csvGeneratedAt: null,
        completedAt: null,
      },
    ]);
  });

  it("lists open sessions with channel, block count, and status", async () => {
    const UploadsPage = (await import("@/app/uploads/page")).default;
    const page = await UploadsPage();
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("Open");
    expect(html).toContain("UP-0001");
    expect(html).toContain("UP-0002");
    expect(html).toContain(BLOCK_CHANNEL_LABELS.MANAPOOL);
    expect(html).toContain("2 blocks");
    expect(html).toContain("3 blocks");
    expect(html).toContain(UPLOAD_SESSION_STATUS_LABELS.CSV_READY);
    expect(html).toContain(UPLOAD_SESSION_STATUS_LABELS.DRAFT);
  });
});

describe("CHL-007 upload session detail page", () => {
  beforeEach(async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue(managerSession);

    const { getUploadSessionDetail } = await import("@/lib/upload-sessions");
    vi.mocked(getUploadSessionDetail).mockResolvedValue({
      id: "session-1",
      sessionId: "UP-0001",
      channel: "MANAPOOL",
      status: "CSV_READY",
      createdAt: new Date("2026-08-10T10:00:00Z"),
      createdBy: "staff@test.local",
      csvGeneratedAt: new Date("2026-08-10T11:00:00Z"),
      completedAt: null,
      cancelledAt: null,
      latestExport: {
        filename: "UP-0001-manapool-listing.csv",
        rowCount: 120,
        createdAt: new Date("2026-08-10T11:00:00Z"),
      },
      blocks: [
        {
          id: "block-7",
          blockId: "MTG-0007",
          label: null,
          status: "SEALED",
          cardCount: 42,
          listableRowCount: 40,
          locationLabel: "TEST-A / TEST-A-B01",
        },
        {
          id: "block-8",
          blockId: "MTG-0008",
          label: "Staging brick B",
          status: "SEALED",
          cardCount: 38,
          listableRowCount: 36,
          locationLabel: "TEST-A / TEST-A-B02",
        },
      ],
    });
  });

  it("shows reserved blocks with location and card counts", async () => {
    const UploadSessionPage = (await import("@/app/uploads/[sessionId]/page")).default;
    const page = await UploadSessionPage({
      params: Promise.resolve({ sessionId: "UP-0001" }),
    });
    const html = renderToStaticMarkup(page as ReactElement);

    expect(html).toContain("MTG-0007");
    expect(html).toContain("MTG-0008");
    expect(html).toContain("TEST-A / TEST-A-B01");
    expect(html).toContain("TEST-A / TEST-A-B02");
    expect(html).toContain(">42<");
    expect(html).toContain(">38<");
    expect(html).toContain("Download CSV");
    expect(html).toContain("Complete session");
    expect(html).toContain("Cancel session");
  });
});
