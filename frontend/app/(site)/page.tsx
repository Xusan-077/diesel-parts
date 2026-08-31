import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import { canonicalPath } from "@/lib/seo";
import { readHomeProducts } from "@/lib/api/home-products";
import { safeRead } from "@/lib/api/safe-read";
import { HOME_ROW_SIZE } from "@/lib/product-collections";
import { Hero } from "@/components/marketing/hero";
import { TrustBadges } from "@/components/marketing/trust-badges";
import { CategoryGrid } from "@/components/marketing/category-grid";
import { BrandGrid } from "@/components/marketing/brand-grid";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { HomeProductRow } from "@/components/marketing/home-product-row";
import { CtaBanner } from "@/components/marketing/cta-banner";
import { Reveal } from "@/components/marketing/reveal";
import { OrganizationJsonLd } from "@/components/marketing/organization-json-ld";
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
   * that down with a 500 was the wrong trade, so the product rows are read as
   * something the page can lose.
   *
   * The rows themselves are client components backed by `/api/products/home`,
   * and this read is what seeds them. It buys two things a pure client fetch
   * gives up: the cards are in the HTML, which is what a crawler indexes and
   * what a visitor sees before any JavaScript runs, and the first visit costs
   * no request at all. React Query still owns them afterwards — it is what
   * refetches when the seed goes stale and what the "try again" button calls,
   * so a row whose read failed can recover without reloading the page.
   *
   * One read for all three rows, and one seed: they share a query key, so the
   * payload below is written into the cache once however many rows read it.
   */
  const home = await safeRead(
    "home rows",
    () => readHomeProducts(HOME_ROW_SIZE, lang),
    undefined,
  );

  const rowProps = {
    // Undefined when the read failed, which leaves the rows to try the API
    // themselves rather than rendering a shop with nothing in it.
    initialData: home.data,
    unavailableLabel: dict.common.productsUnavailable,
    loadingLabel: dict.common.loading,
    retryLabel: dict.common.retry,
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
    },
  };

  /*
   * Every section below the hero rises into place the first time it is scrolled
   * to. Eight stacked sections read as one long static document otherwise, and
   * the reveal is what acknowledges the scroll.
   *
   * The hero is deliberately not wrapped: it is on screen before anyone can
   * scroll, so it has no entrance to make, and it already runs its own staged
   * one. The product rows are not wrapped either — the carousel inside them
   * measures its track on mount, and an ancestor mid-transform when it measures
   * gets the wrong number.
   */
  return (
    <main>
      <OrganizationJsonLd footer={dict.footer} />
      <Hero home={dict.home} common={dict.common} lang={lang} />

      <Container as="section" className="py-20">
        <Reveal>
          <TrustBadges items={dict.home.trustBadges} />
        </Reveal>
      </Container>

      <HomeProductRow
        {...rowProps}
        collection="popular"
        title={dict.home.popularTitle}
        id="popular"
      />

      <Container as="section" className="py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold text-foreground">{dict.home.categoriesTitle}</h2>
          <p className="mt-2 text-sm text-muted">{dict.home.categoriesSubtitle}</p>
        </Reveal>
        {/*
          Not wrapped in `Reveal late`: the category belt runs its own entrance,
          and an ancestor mid-transform is exactly what a row that measures
          itself on mount must not be given.
        */}
        <div className="mt-8">
          <CategoryGrid lang={lang} unavailableLabel={dict.common.dataUnavailable} />
        </div>
      </Container>

      <HomeProductRow
        {...rowProps}
        collection="newest"
        title={dict.home.newTitle}
        ribbon={dict.home.newBadge}
        id="newest"
      />

      <section className="border-y border-border bg-background-subtle">
        <Container className="py-16">
          <Reveal>
            <h2 className="text-2xl font-semibold text-foreground">{dict.home.whyUsTitle}</h2>
            <p className="mt-2 text-sm text-muted">{dict.home.whyUsSubtitle}</p>
          </Reveal>
          <Reveal late>
            <FeatureGrid items={dict.home.whyUs} className="mt-8" />
          </Reveal>
        </Container>
      </section>

      <HomeProductRow
        {...rowProps}
        collection="bestSellers"
        title={dict.home.bestSellersTitle}
        id="best-sellers"
      />

      <Container as="section" className="py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold text-foreground">{dict.home.brandsTitle}</h2>
        </Reveal>
        <Reveal late className="mt-8">
          <BrandGrid unavailableLabel={dict.common.dataUnavailable} />
        </Reveal>
      </Container>

      <Container as="section" className="py-16">
        <Reveal>
          <h2 className="text-2xl font-semibold text-foreground">{dict.home.aboutTitle}</h2>
          <p className="mt-4 max-w-2xl text-muted">{dict.home.aboutText}</p>
        </Reveal>
      </Container>

      <Container as="section" className="pb-24">
        <Reveal>
          <CtaBanner home={dict.home} />
        </Reveal>
      </Container>
    </main>
  );
}
