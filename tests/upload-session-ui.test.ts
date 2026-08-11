import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CompleteSessionConfirmPanel,
  SessionActions,
} from "@/app/uploads/[sessionId]/session-actions";

vi.mock("@/app/uploads/actions", () => ({
  generateUploadSessionCsvAction: vi.fn(),
  completeUploadSessionAction: vi.fn(),
  cancelUploadSessionAction: vi.fn(),
}));

vi.mock("@/components/submit-button", () => ({
  SubmitButton: ({ idleLabel }: { idleLabel: string }) =>
    createElement("button", { type: "submit" }, idleLabel),
}));

const sampleBlock = {
  id: "block-internal-1",
  blockId: "MTG-0007",
  label: null,
  status: "SEALED",
  cardCount: 40,
  listableRowCount: 38,
  locationLabel: "A-01",
};

describe("CHL-005 complete confirmation UI", () => {
  it("shows disclaimer and confirmed submit on the confirm panel", () => {
    const html = renderToStaticMarkup(
      createElement(CompleteSessionConfirmPanel, {
        sessionId: "UP-0001",
        completeAction: vi.fn(),
        completeResult: null,
        onBack: vi.fn(),
      }),
    );

    expect(html).toContain("does not verify Mana Pool accepted this file");
    expect(html).toContain('name="confirmed"');
    expect(html).toContain('value="true"');
    expect(html).toContain("Yes, mark all blocks active");
  });

  it("does not show complete submit until staff open the confirm step", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "CSV_READY",
        csvGeneratedAt: new Date("2026-08-10T12:00:00Z"),
        latestExport: {
          filename: "UP-0001-manapool-listing.csv",
          rowCount: 120,
          createdAt: new Date("2026-08-10T12:00:00Z"),
        },
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).toContain("Complete session");
    expect(html).not.toContain("Yes, mark all blocks active");
    expect(html).not.toContain("does not verify Mana Pool accepted this file");
    expect(html).not.toContain('name="confirmed"');
  });
});

describe("CHL-006 cancel warning UI", () => {
  it("warns that Mana Pool may already have been updated when CSV_READY", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "CSV_READY",
        csvGeneratedAt: new Date("2026-08-10T12:00:00Z"),
        latestExport: {
          filename: "UP-0001-manapool-listing.csv",
          rowCount: 120,
          createdAt: new Date("2026-08-10T12:00:00Z"),
        },
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).toContain("Cancel session");
    expect(html).toContain("Mana Pool may already have been updated");
  });

  it("does not show CSV_READY cancel warning on DRAFT sessions", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "DRAFT",
        csvGeneratedAt: null,
        latestExport: null,
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).toContain("Cancel session");
    expect(html).not.toContain("Mana Pool may already have been updated");
  });
});

describe("CHL-007 session action matrix", () => {
  it("DRAFT shows generate and cancel without complete or download", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0002",
        status: "DRAFT",
        csvGeneratedAt: null,
        latestExport: null,
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).toContain("Generate CSV");
    expect(html).toContain("Cancel session");
    expect(html).not.toContain("Complete session");
    expect(html).not.toContain("Download CSV");
    expect(html).not.toContain("Regenerate CSV");
  });

  it("CSV_READY shows regenerate, download, complete, cancel, and warning", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "CSV_READY",
        csvGeneratedAt: new Date("2026-08-10T12:00:00Z"),
        latestExport: {
          filename: "UP-0001-manapool-listing.csv",
          rowCount: 120,
          createdAt: new Date("2026-08-10T12:00:00Z"),
        },
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).toContain("Regenerate CSV");
    expect(html).toContain("Download CSV");
    expect(html).toContain("Complete session");
    expect(html).toContain("Cancel session");
    expect(html).toContain("Mana Pool may already have been updated");
  });

  it("COMPLETED hides open-session actions", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "COMPLETED",
        csvGeneratedAt: new Date("2026-08-10T12:00:00Z"),
        latestExport: {
          filename: "UP-0001-manapool-listing.csv",
          rowCount: 120,
          createdAt: new Date("2026-08-10T12:00:00Z"),
        },
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).not.toContain("Actions");
    expect(html).not.toContain("Cancel session");
    expect(html).not.toContain("Generate CSV");
    expect(html).toContain("MTG-0007");
  });

  it("CANCELLED hides open-session actions", () => {
    const html = renderToStaticMarkup(
      createElement(SessionActions, {
        sessionId: "UP-0001",
        status: "CANCELLED",
        csvGeneratedAt: null,
        latestExport: null,
        blocks: [sampleBlock],
        canComplete: true,
      }),
    );

    expect(html).not.toContain("Actions");
    expect(html).not.toContain("Cancel session");
    expect(html).toContain("MTG-0007");
  });
});
