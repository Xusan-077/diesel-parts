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
    // TEMPORARY: these still read seed data directly. Removed in Task 8 of
    // docs/superpowers/plans/2026-08-17-catalog-database-foundation.md once
    // every one of them reads through the repository.
    //
    // `*` stands in for the `[lang]` and `[slug]` segments: ESLint matches
    // these with minimatch, where `[lang]` is a character class rather than a
    // directory name, so the literal bracketed path can never match.
    files: [
      "app/sitemap.ts",
      "app/*/page.tsx",
      "app/*/products/*/page.tsx",
      "app/*/categories/*/page.tsx",
      "app/*/brands/*/page.tsx",
      "lib/api/product-repository.ts",
      "lib/product-lookup.ts",
      "components/marketing/brand-grid.tsx",
      "components/marketing/category-grid.tsx",
      "components/marketing/product-row.tsx",
      "components/product/product-catalog-client.tsx",
      "components/product/related-products.tsx",
    ],
    rules: { "no-restricted-imports": "off" },
  },
]);

export default eslintConfig;
