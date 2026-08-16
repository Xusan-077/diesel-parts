import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";
import { BrandGrid } from "@/components/marketing/brand-grid";
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
    title: `${dict.brandsIndex.title} — ${dict.meta.siteName}`,
    description: dict.brandsIndex.subtitle,
    alternates: localeAlternates(lang, "/brands"),
  };
}

export default async function BrandsPage({
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
      title={dict.brandsIndex.title}
      subtitle={dict.brandsIndex.subtitle}
      home={dict.home}
    >
      <h2 className="text-xl font-semibold text-foreground">{dict.brandsIndex.gridTitle}</h2>
      <div className="mt-8">
        <BrandGrid lang={lang} />
      </div>
    </ContentPage>
  );
}
