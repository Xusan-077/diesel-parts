import { themeInitScript } from "@/lib/store/theme";

/**
 * Puts the `dark` class on `<html>` before the first paint, so a dark-mode
 * visitor never sees a white flash. Render it as the first child of `<body>`
 * in every root layout: `<html>` is already parsed by then, and both root
 * layouts mark it `suppressHydrationWarning` so the class this adds is not
 * read as a hydration mismatch.
 *
 * No `"use client"` here on purpose. The script has to reach the browser as
 * literal markup that the HTML parser runs; nothing about it belongs in the
 * client bundle, so it stays out of the provider's client module.
 *
 * Do not reach for `next/script`. With `strategy="beforeInteractive"` and no
 * `src`, the App Router does not emit this code at all — it emits a
 * `(self.__next_s=self.__next_s||[]).push(...)` queue entry that Next's own
 * runtime drains in `app-bootstrap.js`, long after the first paint. That
 * trades the flash back in for nothing.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />;
}
