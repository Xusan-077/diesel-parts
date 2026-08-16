import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.delivery.title} — ${dict.meta.siteName}`,
    description: dict.delivery.subtitle,
    alternates: localeAlternates(lang, "/delivery"),
  };
}

export default async function DeliveryPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <ContentPage
      lang={lang}
      title={dict.delivery.title}
      subtitle={dict.delivery.subtitle}
      home={dict.home}
    >
      <FeatureGrid items={dict.delivery.items} />
      <p className="mx-auto mt-10 max-w-3xl rounded-lg border border-border bg-surface-muted p-5 text-sm leading-relaxed text-muted">
        {dict.delivery.note}
      </p>
    </ContentPage>
  );
}
