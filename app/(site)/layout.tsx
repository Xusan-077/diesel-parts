import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "../globals.css";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { OG_IMAGE, OG_LOCALES, SITE_ICONS, SITE_URL } from "@/lib/site-config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { getSession } from "@/lib/auth/session";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { LocationSection } from "@/components/layout/location-section";
import { RouteBreadcrumb } from "@/components/layout/route-breadcrumb";
import { staticRouteLabels } from "@/lib/breadcrumb";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeScript } from "@/components/theme-script";
import { QueryProvider } from "@/components/providers/query-provider";
import { StoreHydration } from "@/components/providers/store-hydration";
import { LanguageSync } from "@/components/providers/language-sync";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/providers/toaster";
import { FloatingContactWidget } from "@/components/layout/floating-contact-widget";

/*
 * Only the sans face is loaded. Geist Mono was declared alongside it but no
 * rule ever referenced `font-mono`, so its woff2 was still being preloaded and
 * downloaded on every page for nothing. `--font-mono` now points at the system
 * mono stack, which keeps the `font-mono` utility working at zero cost.
 *
 * `subsets` controls preloading, not coverage — the Cyrillic unicode-range
 * face is still served, so the Russian locale renders in Geist and only
 * fetches that file when the language cookie says `ru`.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);

  return {
    metadataBase: new URL(SITE_URL),
    // No `template` here: every page already appends the site name itself and
    // a template would double it.
    title: dict.meta.siteName,
    description: dict.meta.tagline,
    // `alternates` is deliberately not set here — see lib/seo.ts. Pages set
    // their own so each canonical points at the page itself.
    icons: SITE_ICONS,
    manifest: "/site.webmanifest",
    openGraph: {
      type: "website",
      siteName: dict.meta.siteName,
      locale: OG_LOCALES[lang],
      alternateLocale: SUPPORTED_LOCALES.filter((l) => l !== lang).map((l) => OG_LOCALES[l]),
      // No page overrides `openGraph`, so this card is what every route shares.
      // The moment one does, it has to restate `images` — Next replaces the
      // whole `openGraph` object per segment rather than merging into it.
      images: [{ ...OG_IMAGE, alt: dict.meta.siteName }],
    },
    // Next would copy the openGraph images here on its own, but a page that
    // ever sets its own `openGraph` would silently take the twitter card with
    // it. Stated outright, the two cards fail independently.
    twitter: {
      card: "summary_large_image",
      images: [{ ...OG_IMAGE, alt: dict.meta.siteName }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  /*
   * The header shows the signed-in visitor their own number in place of the
   * account icon, and the session cookie is httpOnly — so it is read here,
   * where the cookie is readable, rather than guessed at in the browser.
   * The layout is already dynamic (`getLocale` reads a cookie too), so this
   * costs nothing it was not already paying.
   */
  const session = await getSession();

  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased`}
    >
      {/*
        `site-root` is what scopes the storefront's palette — see the
        MARKETING SITE PALETTE block in app/globals.css. It sits on <body>
        rather than <html> for the same reason `admin-root` does: the theme
        class lands on <html>, so the override has to be a descendant of it
        (`.dark .site-root`) to outweigh `.dark`.
      */}
      <body className="site-root min-h-full flex flex-col bg-background text-foreground">
        <ThemeScript />
        <ThemeProvider>
          <MotionProvider>
            <QueryProvider>
              <StoreHydration />
              <LanguageSync serverLanguage={lang} />
              {/*
                The header carries three rows of navigation before the page
                content starts, so keyboard and screen-reader users get a way
                past it. Hidden until focused.
              */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
              >
                {dict.common.skipToContent}
              </a>
              <Header
                lang={lang}
                siteName={dict.meta.siteName}
                nav={dict.nav}
                header={dict.header}
                closeLabel={dict.common.close}
                viewAllLabel={dict.common.viewAll}
                requestPriceLabel={dict.common.requestPrice}
                hotOfferLabels={{
                  popular: dict.home.popularTitle,
                  bestSellers: dict.home.bestSellersTitle,
                  newest: dict.home.newTitle,
                }}
                account={dict.account}
                phone={session?.phone ?? null}
              />
              <div id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
                {/*
                  Renders for the routes whose path names itself, and stays
                  quiet for home and for slug routes — a product, a brand, a
                  category — which name their own trail from the data they
                  already loaded. See lib/breadcrumb.ts.
                */}
                <RouteBreadcrumb
                  homeLabel={dict.nav.home}
                  label={dict.common.breadcrumbLabel}
                  labels={staticRouteLabels(dict)}
                />
                {children}
              </div>
              {/*
                The map band closes the page above the footer chrome, so it
                is a sibling of <Footer> rather than a block inside it.
              */}
              <LocationSection footer={dict.footer} />
              <Footer
                siteName={dict.meta.siteName}
                footer={dict.footer}
                nav={dict.nav}
                payment={dict.payment}
                phone={dict.contact.phone}
              />
              <FloatingContactWidget support={dict.support} closeLabel={dict.common.close} />
              <Toaster />
            </QueryProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
