import { accentInitScript } from "@/lib/admin/accent";
import { railInitScript } from "@/lib/admin/rail";

/**
 * Stamps the accent set and the rail width onto `<html>` before the first
 * paint, the same contract `ThemeScript` already holds for the `dark` class.
 *
 * One `<script>` for both, because two would cost a second parse for eleven
 * bytes of separation. Render it as a child of `<body>` in the panel's root
 * layout, which marks `<html>` `suppressHydrationWarning` so neither attribute
 * is read as a mismatch.
 *
 * No `"use client"`. This has to reach the browser as literal markup the HTML
 * parser runs; nothing about it belongs in the client bundle. `next/script`
 * with `strategy="beforeInteractive"` and no `src` would not emit it at all —
 * see the note on `ThemeScript` for the full story.
 *
 * Panel-only. The marketing site has one brand colour and no sidebar, so
 * neither attribute ever reaches it.
 */
export function PanelChromeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: accentInitScript() + ";" + railInitScript() }}
    />
  );
}
