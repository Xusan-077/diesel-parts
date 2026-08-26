import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
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
 * A root layout of its own — the fourth this project has, beside the
 * marketing site, the admin/seller panel and the standalone seller panel.
 * See `DIRECTOR_ROOT` in lib/auth/roles.ts for why the director's own pages
 * moved out from under `/admin` rather than staying a nested subtree of it.
 *
 * The font loading and the panel chrome (`admin-root`, `ThemeProvider`,
 * `QueryProvider`) are copied from app/admin/layout.tsx rather than shared,
 * because a Next.js root layout owns its own `<html>`/`<body>` and cannot
 * nest inside another one. Keep the two in step by hand if either changes.
 *
 * This layer stays neutral on purpose — no `requireDirector()`, no
 * `PanelShell` — because `/director/login` is a sibling of the gated
 * `(panel)` route group that carries both: a root layout wraps every route
 * under it including its own login screen, and a login screen that demanded
 * a director cookie to render could never be reached by someone who does not
 * have one yet. See app/director/(panel)/layout.tsx for the gate.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Direktor paneli · Diesel Parts",
  // The panel is a root layout of its own, so it inherits nothing from the
  // storefront and has to name the icons itself or staff get a blank tab.
  icons: SITE_ICONS,
  // The panel must never reach an index, whatever the crawler was told elsewhere.
  robots: { index: false, follow: false },
};

export default function DirectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`admin-root ${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ClarityInit />
        <ThemeScript />
        <PanelChromeScript />
        {/* One line at the top of the viewport for every navigation between
            director pages — Server Component routes have no built-in loading
            affordance of their own, so without this a click sat idle until
            the next screen's data arrived. `--accent` rather than a hardcoded
            hex, so it stays the panel's one brand colour if that token ever
            moves. */}
        <NextTopLoader
          color="var(--accent)"
          height={2}
          showSpinner={false}
          shadow={false}
          crawlSpeed={100}
          speed={300}
          easing="cubic-bezier(0.16, 1, 0.3, 1)"
        />
        <ThemeProvider>
          {/* reducedMotion="user" is the panel's single motion guard: every
              motion component below it honours the OS setting without each one
              having to remember to ask. The CSS half of the guard already
              lives in globals.css. */}
          <MotionProvider>
            {/* A root layout of its own, so this provider is this panel's copy
                rather than a second cache for the storefront's — see
                app/admin/layout.tsx's own note on the same point. */}
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
