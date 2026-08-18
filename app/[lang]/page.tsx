import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/locales";
import { products } from "@/prisma/seed-data/products";
import { localeAlternates } from "@/lib/seo";
import {
  getBestSellerProducts,
  getNewProducts,
  getPopularProducts,
} from "@/lib/product-collections";
import { Hero } from "@/components/marketing/hero";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ProductRow } from "@/components/marketing/product-row";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Container } from "@/components/ui/container";

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
    alternates: localeAlternates(lang, ""),
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

  const rowProps = {
    lang,
    viewAllHref: `/${lang}/products`,
    viewAllLabel: dict.common.viewAll,
    stock: dict.common.stock,
    requestPriceLabel: dict.common.requestPrice,
    actions: dict.productActions,
    carousel: {
      prev: dict.common.carouselPrev,
      next: dict.common.carouselNext,
      pause: dict.common.carouselPause,
      play: dict.common.carouselPlay,
    },
  };

  return (
    <main>
      <Hero lang={lang} home={dict.home} />

      <Container as="section" className="py-20">
        <TrustBadges items={dict.home.trustBadges} />
      </Container>

      {/* Only the lead row advances on its own — three self-scrolling rows on
          one page would compete for attention rather than draw it. */}
      <ProductRow
        {...rowProps}
        title={dict.home.popularTitle}
        products={getPopularProducts(products)}
        autoplay
      />

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.categoriesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{dict.home.categoriesSubtitle}</p>
        <div className="mt-8">
          <CategoryGrid lang={lang} />
        </div>
      </Container>

      <ProductRow
        {...rowProps}
        title={dict.home.newTitle}
        products={getNewProducts(products)}
        ribbon={dict.home.newBadge}
      />

      <section className="border-y border-border bg-surface-muted">
        <Container className="py-16">
          <h2 className="text-2xl font-semibold text-foreground">{dict.home.whyUsTitle}</h2>
          <p className="mt-2 text-sm text-muted">{dict.home.whyUsSubtitle}</p>
          <FeatureGrid items={dict.home.whyUs} className="mt-8" />
        </Container>
      </section>

      <ProductRow
        {...rowProps}
        title={dict.home.bestSellersTitle}
        products={getBestSellerProducts(products)}
      />

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.brandsTitle}</h2>
        <div className="mt-8">
          <BrandGrid lang={lang} />
        </div>
      </Container>

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.aboutTitle}</h2>
        <p className="mt-4 max-w-2xl text-muted">{dict.home.aboutText}</p>
      </Container>

      <Container as="section" className="pb-24">
        <CtaBanner lang={lang} home={dict.home} />
      </Container>
    </main>
  );
}
