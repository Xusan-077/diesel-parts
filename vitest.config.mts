import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // Nested node_modules (agent worktrees) ship their own test suites.
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
  },
});
