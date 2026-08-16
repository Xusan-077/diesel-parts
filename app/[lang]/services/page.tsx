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
    title: `${dict.services.title} — ${dict.meta.siteName}`,
    description: dict.services.subtitle,
    alternates: localeAlternates(lang, "/services"),
  };
}

export default async function ServicesPage({
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
      title={dict.services.title}
      subtitle={dict.services.subtitle}
      home={dict.home}
    >
      <FeatureGrid items={dict.services.items} />
    </ContentPage>
  );
}
