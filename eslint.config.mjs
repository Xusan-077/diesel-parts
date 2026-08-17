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
]);

export default eslintConfig;
