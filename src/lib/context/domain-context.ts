/**
 * Domain context for inventory mutations (ADR-001).
 * Actor is null until ACC-001 auth is implemented.
 */
export interface DomainContext {
  actor: { id: string; email?: string } | null;
  source: "ui" | "api" | "webhook" | "test";
}

export const SYSTEM_CONTEXT: DomainContext = {
  actor: null,
  source: "ui",
};

export const TEST_CONTEXT: DomainContext = {
  actor: null,
  source: "test",
};
