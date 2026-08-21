import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { HOME_ROW_SIZE } from "@/lib/product-collections";
import { getProductsForHomeRows } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { Hero } from "@/components/marketing/hero";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { ProductRow } from "@/components/marketing/product-row";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Container } from "@/components/ui/container";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  return {
    title: `${dict.meta.siteName} — ${dict.home.heroTitle}`,
    description: dict.home.heroSubtitle,
    alternates: canonicalPath(""),
  };
}

export default async function HomePage() {
  const lang = await getLocale();
  const dict = getDictionary(lang);
  /*
   * The home page is mostly hard-coded marketing copy — a hero, four trust
   * badges, a "why us" grid, an about paragraph and a call to action, none of
   * which need a database. Letting one unreachable catalog query take all of
   * that down with a 500 was the wrong trade, so the three product rows are
   * read as something the page can lose.
   */
  const rows = await safeRead("home rows", () => getProductsForHomeRows(HOME_ROW_SIZE), {
    popular: [],
    newest: [],
    bestSellers: [],
  });
  const { popular, newest, bestSellers } = rows.data;

  const rowProps = {
    // Every row shares the same failure, because they share one query.
    unavailable: !rows.ok,
    unavailableLabel: dict.common.productsUnavailable,
    lang,
    viewAllHref: "/products",
    viewAllLabel: dict.common.viewAll,
    stock: dict.common.stock,
    requestPriceLabel: dict.common.requestPrice,
    actions: dict.productActions,
    productDict: dict.product,
    carousel: {
      prev: dict.common.carouselPrev,
      next: dict.common.carouselNext,
      pause: dict.common.carouselPause,
      play: dict.common.carouselPlay,
    },
  };

  return (
    <main>
      <Hero home={dict.home} common={dict.common} lang={lang} />

      <Container as="section" className="py-20">
        <TrustBadges items={dict.home.trustBadges} />
      </Container>

      {/* Only the lead row advances on its own — three self-scrolling rows on
          one page would compete for attention rather than draw it. */}
      <ProductRow
        {...rowProps}
        title={dict.home.popularTitle}
        products={popular}
        autoplay
      />

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.categoriesTitle}</h2>
        <p className="mt-2 text-sm text-muted">{dict.home.categoriesSubtitle}</p>
        <div className="mt-8">
          <CategoryGrid lang={lang} unavailableLabel={dict.common.dataUnavailable} />
        </div>
      </Container>

      <ProductRow
        {...rowProps}
        title={dict.home.newTitle}
        products={newest}
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
        products={bestSellers}
      />

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.brandsTitle}</h2>
        <div className="mt-8">
          <BrandGrid unavailableLabel={dict.common.dataUnavailable} />
        </div>
      </Container>

      <Container as="section" className="py-16">
        <h2 className="text-2xl font-semibold text-foreground">{dict.home.aboutTitle}</h2>
        <p className="mt-4 max-w-2xl text-muted">{dict.home.aboutText}</p>
      </Container>

      <Container as="section" className="pb-24">
        <CtaBanner home={dict.home} />
      </Container>
    </main>
  );
}
