import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/server-locale";
import {
  getProductBySlug,
  listBrands,
  listCategories,
} from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageUnavailable } from "@/components/layout/page-unavailable";
import type { Brand, Category } from "@/lib/types";
import { ProductGallery } from "@/components/product/product-gallery";
import { SpecsTable } from "@/components/product/specs-table";
import { StockBadge } from "@/components/product/stock-badge";
import { ProductActions } from "@/components/product/product-actions";
import { formatPrice } from "@/lib/format-price";
import { canonicalPath } from "@/lib/seo";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductStatsRow } from "@/components/product/product-stats-row";
import { getProductStatsFor } from "@/lib/api/product-stats-repository";
import { EMPTY_STATS } from "@/lib/product-stats";
import { ProductReviews } from "@/components/product/product-reviews";
import {
  getOwnReview,
  hasPurchasedProduct,
  listProductReviews,
} from "@/lib/api/review-repository";
import { getSession } from "@/lib/auth/session";
import { REVIEWS_PAGE_SIZE, type PublicReview } from "@/lib/reviews";
import { ProductJsonLd } from "@/components/product/product-json-ld";
import { InquiryDialog } from "@/components/forms/inquiry-dialog";
import { Container } from "@/components/ui/container";
import { Breadcrumb, BreadcrumbJsonLd } from "@/components/breadcrumb";
import { finalise, type BreadcrumbItem } from "@/lib/breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Metadata is worth nothing on its own: an unreadable product means no tags,
  // never a failed render before the page even gets its turn.
  const { data: product } = await safeRead("product metadata", () => getProductBySlug(slug), null);
  const lang = await getLocale();
  if (!product) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: `${product.name[lang]} — ${dict.meta.siteName}`,
    description: product.description[lang],
    alternates: canonicalPath(`/products/${product.slug}`),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lang = await getLocale();
  const dict = getDictionary(lang);

  /*
   * This row *is* the page, so its two failure modes have to stay apart. A row
   * that is missing is a real 404. A row that could not be read is an outage,
   * and answering that with a 404 would tell the visitor — and every crawler —
   * that a product which exists does not.
   */
  const lookup = await safeRead("product", () => getProductBySlug(slug), null);
  if (!lookup.ok) {
    return (
      <PageUnavailable title={dict.common.pageUnavailable} message={dict.common.dataUnavailable} />
    );
  }

  const product = lookup.data;
  if (!product) {
    notFound();
  }

  // Names for the breadcrumb line and the structured data. Losing them costs
  // a label and the JSON-LD block, not the page.
  /*
   * The log's first page and this reader's own entry, both server-read so the
   * section is in the HTML and the form seeds without a round trip. `getOwnReview`
   * is an indexed lookup by (product, phone) rather than a scan of the loaded
   * page, so it finds their review even when it sits on page four.
   */
  const session = await getSession();

  const [categories, brands, stats, reviewPage, ownReview, purchased] = await Promise.all([
    safeRead("product page categories", listCategories, [] as Category[]),
    safeRead("product page brands", listBrands, [] as Brand[]),
    // A line under the heading; unreadable figures cost that line, not the page.
    safeRead("product page stats", () => getProductStatsFor(product.id), EMPTY_STATS),
    // Reviews are worth a section, not the page. An unreadable log renders as
    // an empty one with a working form, exactly as a part with no reviews does.
    safeRead(
      "product reviews",
      () => listProductReviews(product.id, 1, REVIEWS_PAGE_SIZE, session?.phone),
      { items: [] as PublicReview[], total: 0, page: 1, pageSize: REVIEWS_PAGE_SIZE, totalPages: 1 },
    ),
    safeRead(
      "own review",
      () => (session ? getOwnReview(product.id, session.phone) : Promise.resolve(null)),
      null,
    ),
    /*
     * Whether this reader has a completed order for this part, which is what
     * decides between the form and an explanation.
     *
     * `false` when the read fails, and deliberately so: the fallback for a
     * gate is the closed position. A visitor briefly told to buy the part they
     * already own is a worse afternoon than nothing; a form that appears
     * because the database was down and then refuses the submission is a worse
     * one still, and `POST /api/reviews` would refuse it.
     */
    safeRead(
      "review eligibility",
      () =>
        session
          ? hasPurchasedProduct(product.id, session.phone)
          : Promise.resolve(false),
      false,
    ),
  ]);
  const category = categories.data.find((c) => c.id === product.categoryId);
  const brand = brands.data.find((b) => b.id === product.brandId);

  /*
   * A product always has both, but the row could have been deleted out from
   * under it — that is a genuine 404. Only trusted when both lookups actually
   * succeeded, so an unreadable table cannot masquerade as a deleted row.
   */
  if (categories.ok && brands.ok && (category === undefined || brand === undefined)) {
    notFound();
  }

  /*
   * Catalogue, then the part's own two coordinates, then the part. Brand and
   * category are each dropped when their row could not be read rather than
   * printing an empty crumb — a trail with a gap in it is worse than a
   * shorter one.
   */
  const trail = finalise(
    [
      { label: dict.nav.home, href: "/" },
      { label: dict.nav.allProducts, href: "/products" },
      category
        ? { label: category.name[lang], href: `/categories/${category.slug}` }
        : null,
      brand ? { label: brand.name, href: `/brands/${brand.slug}` } : null,
      { label: product.name[lang] },
    ].filter((item): item is BreadcrumbItem => item !== null),
  );

  return (
    <Container as="main" className="pb-24 pt-6">
      <Breadcrumb items={trail} label={dict.common.breadcrumbLabel} className="mb-8" />
      <BreadcrumbJsonLd items={trail} />

      {category && brand ? (
        <ProductJsonLd product={product} category={category} brand={brand} lang={lang} />
      ) : null}

      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery
          imageUrl={product.imageUrl}
          galleryAlt={product.name[lang]}
          zoomLabel={dict.product.zoomLabel}
          closeLabel={dict.product.zoomCloseLabel}
        />

        <div>
          <p className="text-sm text-muted">{brand?.name ?? ""}</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">{product.name[lang]}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted">
            <span>
              {dict.product.skuLabel}: {product.sku}
            </span>
            <span>
              {dict.product.oemLabel}: {product.oemNumbers.join(", ")}
            </span>
            <StockBadge status={product.stockStatus} stock={dict.common.stock} />
          </div>

          <ProductStatsRow
            stats={stats.data}
            lang={lang}
            dict={dict.product}
            className="mt-3"
          />

          <p className="mt-6 text-foreground">{product.description[lang]}</p>

          <div>
            <h2 className="mt-8 text-lg font-semibold text-foreground">
              {dict.product.compatibleModelsTitle}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {product.compatibleModels.map((model) => (
                <li key={model} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
                  {model}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {formatPrice(product.price, lang) ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">
                  {dict.product.priceLabel}
                </p>
                <p className="mt-1 text-3xl font-semibold text-foreground">
                  {formatPrice(product.price, lang)}
                </p>
              </div>
            ) : (
              <p className="text-2xl font-semibold text-accent-strong">{dict.common.requestPrice}</p>
            )}

            <ProductActions
              product={product}
              brandName={brand?.name ?? ""}
              categoryName={category?.name[lang] ?? ""}
              lang={lang}
              dict={dict.productActions}
              requestPriceLabel={dict.common.requestPrice}
            />
            <InquiryDialog
              productId={product.id}
              productSlug={product.slug}
              dict={dict.inquiry}
              closeLabel={dict.common.close}
            />
          </div>
        </div>
      </div>

      <div className="mt-16">
        <SpecsTable specs={product.specs} lang={lang} title={dict.product.specificationsTitle} />
      </div>

      <div className="mt-16">
        <ProductReviews
          productId={product.id}
          initialPage={reviewPage.data}
          initialOwn={ownReview.data}
          canReview={purchased.data}
          dict={dict.reviews}
          productDict={dict.product}
          account={dict.account}
          closeLabel={dict.common.close}
        />
      </div>

      <div className="mt-16">
        <RelatedProducts
          product={product}
          lang={lang}
          title={dict.product.relatedProductsTitle}
          stock={dict.common.stock}
          requestPriceLabel={dict.common.requestPrice}
          actions={dict.productActions}
          productDict={dict.product}
        />
      </div>
    </Container>
  );
}
