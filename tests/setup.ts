/**
 * Refuse to run integration tests against a non-test database.
 * Require DATABASE_URL to contain "test" (e.g. tcg_inventory_test).
 */
const url = process.env.DATABASE_URL ?? "";

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Use postgresql://tcg:tcg@localhost:5432/tcg_inventory_test",
  );
}

if (!/test/i.test(url)) {
  throw new Error(
    `Refusing to run tests without a *_test database URL. Got: ${url.replace(/:[^:@/]+@/, ":***@")}`,
  );
}

import { db } from "@/lib/db";

if (!process.env.TCG_TEST_DISCONNECT_HOOK) {
  process.env.TCG_TEST_DISCONNECT_HOOK = "1";
  process.on("beforeExit", () => {
    void db.$disconnect();
  });
}
