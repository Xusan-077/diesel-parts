import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { Hero } from "@/components/marketing/hero";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { FeaturedProducts } from "@/components/marketing/featured-products";
import { CtaBanner } from "@/components/marketing/cta-banner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dict = getDictionary(lang);
  return {
    title: `${dict.meta.siteName} — ${dict.home.heroTitle}`,
    description: dict.home.heroSubtitle,
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const dict = getDictionary(lang);

  return (
    <main>
      <Hero lang={lang} home={dict.home} />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <TrustBadges items={dict.home.trustBadges} />
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.aboutTitle}</h2>
        <p className="mt-4 max-w-2xl text-muted">{dict.home.aboutText}</p>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.categoriesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{dict.home.categoriesSubtitle}</p>
        <div className="mt-8">
          <CategoryGrid lang={lang} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.brandsTitle}</h2>
        <div className="mt-8">
          <BrandGrid lang={lang} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.featuredTitle}</h2>
        <div className="mt-8">
          <FeaturedProducts lang={lang} stock={dict.common.stock} requestPriceLabel={dict.common.requestPrice} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <CtaBanner lang={lang} home={dict.home} />
      </section>
    </main>
  );
}
