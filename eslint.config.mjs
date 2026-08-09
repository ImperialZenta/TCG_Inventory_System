import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// ADR-010 tenancy seams: Prisma access belongs in src/lib domain modules.
// Files listed here imported @/lib/db before the rule existed. When touching one
// for feature work, move its queries into src/lib and delete it from this list.
const grandfatheredDbImports = [
  "src/app/settings/actions.ts",
  "src/app/settings/page.tsx",
  "src/app/blocks/actions.ts",
  "src/app/blocks/\\[blockId\\]/page.tsx",
  "src/app/staging/actions.ts",
  "src/app/staging/page.tsx",
  "src/app/staging/\\[importId\\]/page.tsx",
  "src/app/pick/\\[pickListId\\]/page.tsx",
  "src/app/api/blocks/\\[blockId\\]/export-csv/route.ts",
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/lib/**", ...grandfatheredDbImports],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/db",
              message:
                "Prisma access belongs in src/lib domain modules (ADR-010 tenancy seams, .cursor/rules/tenancy-seams.mdc). Call or add a domain function instead.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
