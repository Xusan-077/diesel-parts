import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees carry their own node_modules; never lint them.
    ".claude/**",
    "**/node_modules/**",
    // Generated Prisma client is build output, not authored code.
    "prisma/generated/**",
  ]),
  {
    rules: {
      // `const { message, ...rest } = input` is how the schema tests build a
      // payload with one field removed; the pulled-out binding is meant to go
      // unused. Everything else still reports.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/prisma/seed-data/*", "**/prisma/seed-data/*"],
              message:
                "Seed data is database input, not an application data source. " +
                "Read through lib/api/product-repository.ts instead, or the " +
                "page will silently bypass the database.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests legitimately use the seed arrays as fixtures.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // TEMPORARY: the last file still reading seed data directly. Removed in
    // Task 8 of docs/superpowers/plans/2026-08-17-catalog-database-foundation.md,
    // once the wishlist, cart and compare lists resolve ids over HTTP instead.
    files: ["lib/product-lookup.ts"],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
