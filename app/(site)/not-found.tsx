import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { WorkshopBackdrop } from "@/components/marketing/workshop-backdrop";
import { getNotFoundStrings } from "@/lib/i18n/fallback-strings";
import { getLocale } from "@/lib/i18n/server-locale";

/*
 * The numeral's face, loaded here and nowhere else on the site.
 *
 * The storefront is set in Geist and has no mono face of its own — the panel
 * loads JetBrains Mono for its tables, and this page is the one public screen
 * that wants that same bench-printout register. Imported in this file so the
 * woff2 is fetched by the 404 and by no other route, and only at the one
 * weight the numeral is stamped in.
 */
const numeral = JetBrains_Mono({
  variable: "--font-nf-mono",
  subsets: ["latin"],
  weight: "700",
});

/**
 * The storefront's 404.
 *
 * Reached from `notFound()` in the product, category, brand and blog routes —
 * a slug that no longer resolves — and from a stale link.
 *
 * It paints its own ground rather than the storefront's: a dark plate under
 * grain, a CRT sweep and two gears turning behind it. That is a deliberate
 * break from every other page, because this is the one screen a visitor lands
 * on by accident, and the site's own surface has nothing to say on it. The
 * header and footer stay above and below, so the way out is never only the
 * button.
 *
 * The strings come from `fallback-strings` rather than the dictionaries — four
 * sentences, against ~70KB of marketing copy. See the note there.
 */
export default async function SiteNotFound() {
  const strings = getNotFoundStrings(await getLocale());

  return (
    <main
      className={`nf-scene nf-grain relative isolate flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-6 py-24 text-center ${numeral.variable}`}
    >
      <WorkshopBackdrop />

      {/* The numeral is the page's whole headline, so it carries the heading
          level; the label under it reads as its subtitle rather than as a
          second title. */}
      <h1 className="nf-numeral">404</h1>

      <p className="mt-8 text-[0.6875rem] font-medium tracking-[0.42em] text-[var(--nf-ink)] uppercase">
        {strings.label}
      </p>

      <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-[var(--nf-muted)]">
        {strings.description}
      </p>

      <Link
        href="/"
        className="mt-10 inline-flex h-12 items-center rounded-full border border-[var(--nf-orange)] px-8 text-xs font-medium tracking-[0.16em] text-[var(--nf-orange)] uppercase transition-colors hover:bg-[var(--nf-orange)] hover:text-[var(--nf-void)]"
      >
        {strings.cta}
      </Link>
    </main>
  );
}
