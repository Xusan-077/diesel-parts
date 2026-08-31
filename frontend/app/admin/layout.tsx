import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import "../globals.css";
import { SITE_ICONS } from "@/lib/site-config";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { ClarityInit } from "@/components/analytics/clarity-init";
import { PanelChromeScript } from "@/components/admin/panel-chrome-script";
import { Toaster } from "@/components/providers/toaster";
import { MotionProvider } from "@/components/providers/motion-provider";
import { QueryProvider } from "@/components/providers/query-provider";

/*
 * The panel is a second root layout. It sits outside the `[lang]` segment
 * because staff are in-house and work in Uzbek only — routing them through the
 * three-locale machinery would triple the translation surface of every table
 * header for no reader.
 *
 * The mono faces are loaded here and nowhere else. The panel is the only place
 * that lines up SKUs, OEM numbers, stock counts and prices in columns, and
 * those only scan as columns in tabular figures.
 *
 * JetBrains Mono is the panel's data face — see the `.admin-root` note in
 * globals.css for why it, and not Geist Mono, carries the figures. Only the
 * two weights the panel actually sets are fetched: 400 for table cells and SKU
 * strings, 600 for the KPI figures and eyebrows.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Boshqaruv paneli · Diesel Parts",
  // The panel is a root layout of its own, so it inherits nothing from the
  // storefront and has to name the icons itself or staff get a blank tab.
  // No manifest and no social card here: nothing is meant to install or share
  // the panel.
  icons: SITE_ICONS,
  // The panel must never reach an index, whatever the crawler was told elsewhere.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      {/*
        * `admin-root` sits on the body, not only on the panel frame.
        *
        * It carries one thing — the `--font-mono` override that puts JetBrains
        * Mono ahead of Geist Mono — and every dialog in the panel is rendered
        * through a Radix portal, which mounts to `document.body` and therefore
        * *outside* the frame. Scoped to the frame alone, a product's SKU was
        * set in JetBrains Mono in the catalogue table and in Geist Mono in the
        * dialog editing that same row.
        *
        * The frame, the login screen and the message pages keep their own
        * `admin-root` class: they are the panel's other entry points, and the
        * declaration is idempotent.
        */}
      <body
        className={`admin-root ${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ClarityInit />
        <ThemeScript />
        <PanelChromeScript />
        <ThemeProvider>
          {/* reducedMotion="user" is the panel's single motion guard: every
              motion component below it honours the OS setting without each one
              having to remember to ask. The CSS half of the guard already
              lives in globals.css. */}
          <MotionProvider>
            {/*
              The panel is a root layout of its own, so it inherits nothing
              from the storefront — including its providers. Every table,
              queue and board under /admin reads through `hooks/admin/*`,
              which are TanStack Query hooks, and without a client above them
              React Query throws "No QueryClient set" on the first render of
              any of those screens. The storefront mounts the same provider in
              app/(site)/layout.tsx; this is the panel's copy, not a second
              cache for the same tree — the two layouts never nest.
            */}
            <QueryProvider>
              {children}
              <Toaster />
            </QueryProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
