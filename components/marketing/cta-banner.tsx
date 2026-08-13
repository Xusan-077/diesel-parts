import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function CtaBanner({ lang, home }: { lang: Locale; home: Dictionary["home"] }) {
  return (
    <section className="rounded-lg border border-accent/30 bg-accent/10 px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">{home.ctaBannerTitle}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm text-muted">{home.ctaBannerText}</p>
      <Link
        href={`/${lang}/contact`}
        className="mt-8 inline-block rounded-md bg-accent px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-accent/90"
      >
        {home.ctaBannerButton}
      </Link>
    </section>
  );
}
