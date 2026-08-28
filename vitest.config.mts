import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "."),
      // `server-only` is a build-time marker. Its default entry throws by
      // design, and under this node environment that is the entry resolved —
      // so point it at the package's own empty module, which is what a React
      // Server Component build gets. Without this, importing any route handler
      // fails before a single assertion runs.
      "server-only": path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "node_modules/server-only/empty.js",
      ),
    },
  },
  test: {
    environment: "node",
    // Components are tested in a DOM; everything else is a pure function that
    // needs none. A React suite opts in with a `@vitest-environment jsdom`
    // docblock rather than paying jsdom's startup cost across the whole run.
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // Nested node_modules (agent worktrees) ship their own test suites.
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
