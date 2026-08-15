import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { QuoteForm } from "@/components/forms/quote-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.requestQuote.title} — ${dict.meta.siteName}`,
    description: dict.requestQuote.subtitle,
  };
}

export default async function RequestQuotePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-24">
      <h1 className="text-3xl font-semibold text-foreground">{dict.requestQuote.title}</h1>
      <p className="mt-2 text-muted">{dict.requestQuote.subtitle}</p>
      <div className="mt-10">
        <QuoteForm dict={dict.requestQuote} />
      </div>
    </main>
  );
}
