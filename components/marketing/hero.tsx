import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function Hero({ lang, home }: { lang: Locale; home: Dictionary["home"] }) {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-b from-[#1a1d24] via-background to-background px-6 text-center">
      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold text-foreground sm:text-6xl">{home.heroTitle}</h1>
        <p className="mt-6 text-lg text-muted">{home.heroSubtitle}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/${lang}/products`}
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-accent/90"
          >
            {home.heroCtaCatalog}
          </Link>
          <Link
            href={`/${lang}/request-quote`}
            className="rounded-md border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
          >
            {home.heroCtaQuote}
          </Link>
        </div>
      </div>
    </section>
  );
}
