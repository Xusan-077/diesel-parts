"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { SortKey } from "@/lib/filters";
import { fetchProducts, productsQueryKey, type ProductListParams } from "@/lib/api/products";
import { DEFAULT_PAGE_SIZE, type ProductPage } from "@/lib/api/product-query";
import {
  activeFilterCount,
  clearFilters,
  DEFAULT_FILTERS,
  describeActiveFilters,
  removeFilter,
  type CatalogFilters,
} from "@/lib/catalog-filters";
import { formatPrice } from "@/lib/format-price";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Brand, Category, Product } from "@/lib/types";
import { ProductFilters } from "./product-filters";
import { FilterChips } from "./filter-chips";
import { FilterDrawer } from "./filter-drawer";
import { CatalogToolbar } from "./catalog-toolbar";
import type { PriceBounds } from "./price-filter";
import { ProductCard } from "@/components/marketing/product-card";
import { Pagination } from "@/components/ui/pagination";

interface ProductCatalogClientProps {
  lang: Locale;
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  productDict: Dictionary["product"];
  /** Filter reference data, read from the database by the server page. */
  categories: Category[];
  brands: Brand[];
  /** The catalog's real price range, for the sidebar slider's two ends. */
  priceBounds: PriceBounds | null;
  /** Seeded from the `?q=` param so the header search lands on real results. */
  initialSearch?: string;
  /**
   * Category ids the catalog menu scoped this page to via its query string.
   * `undefined` means no scope; an empty array is a scope with no products yet.
   */
  scopeCategoryIds?: string[];
  /** Localised name of that scope, shown as a removable chip above the grid. */
  scopeLabel?: string;
  clearScopeLabel?: string;
  /**
   * First page rendered on the server, so there is no loading flash on entry.
   *
   * `null` when the server could not read it. That is not the same as an empty
   * page: seeding React Query with zero results would render "0 products
   * found" as though the catalog were empty, so the query is left unseeded and
   * fetches — landing on the error state below, retry button and all.
   */
  initialData: ProductPage<Product> | null;
}

export function ProductCatalogClient({
  lang,
  dict,
  stockDict,
  requestPriceLabel,
  actions,
  productDict,
  categories,
  brands,
  priceBounds,
  initialSearch = "",
  scopeCategoryIds,
  scopeLabel,
  clearScopeLabel,
  initialData,
}: ProductCatalogClientProps) {
  const [filters, setFilters] = useState<CatalogFilters>({
    ...DEFAULT_FILTERS,
    search: initialSearch,
  });
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  /*
   * The whole filter set is debounced, not just the search box.
   *
   * Every control now writes straight to the state — there is no "search"
   * button to press — and several of them fire continuously: a slider thumb
   * emits a value per pixel dragged, and ticking three brands is three
   * changes in about a second. One 300ms settle in front of the query covers
   * all of them, and `keepPreviousData` below means the grid holds the last
   * result while the next is in flight rather than blanking between them.
   */
  const settled = useDebouncedValue(filters);

  const params: ProductListParams = {
    q: settled.search.trim(),
    brandIds: settled.brandIds,
    categoryId: settled.categoryId,
    categoryIds: scopeCategoryIds,
    availability: settled.availability,
    priceMin: settled.priceMin,
    priceMax: settled.priceMax,
    sort: sortKey,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    lang,
  };

  // Only the untouched first render matches what the server already computed.
  const isInitialParams =
    settled.search === initialSearch &&
    settled.brandIds.length === 0 &&
    settled.categoryId === "all" &&
    settled.availability === "all" &&
    settled.priceMin === null &&
    settled.priceMax === null &&
    sortKey === "newest" &&
    page === 1;

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: productsQueryKey(params),
    queryFn: () => fetchProducts(params),
    initialData: isInitialParams && initialData !== null ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  /** Any narrowing puts the reader back on page one; sort and view do not. */
  function changeFilter<K extends keyof CatalogFilters>(key: K, value: CatalogFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetFilters() {
    setFilters(clearFilters);
    setPage(1);
  }

  const items = data?.items ?? [];
  const stats = data?.stats;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  /*
   * Described from the state the panel edits and the reference data the grid
   * already holds, so a chip cannot drift from the control behind it — the two
   * are the same value read twice, not two copies.
   */
  const chips = describeActiveFilters(filters, {
    search: dict.searchLabel,
    brand: dict.filterBrandLabel,
    category: dict.filterCategoryLabel,
    availability: dict.filterAvailabilityLabel,
    price: dict.filterPriceLabel,
    brandName: (id) => brands.find((brand) => brand.id === id)?.name ?? "",
    categoryName: (id) => categories.find((c) => c.id === id)?.name[lang] ?? "",
    // An open end reads as "from X" or "up to Y" rather than as a range with a
    // blank in it, which the reader would have to decode.
    priceRange: (min, max) => {
      const low = formatPrice(min, lang);
      const high = formatPrice(max, lang);
      if (low !== null && high !== null) {
        return dict.priceRange.replace("{min}", low).replace("{max}", high);
      }
      return low !== null
        ? dict.priceFromOnly.replace("{min}", low)
        : dict.priceToOnly.replace("{max}", high ?? "");
    },
    // `all` never reaches here — it is the value that means "no chip" — but the
    // type includes it, and naming that explicitly beats an index signature.
    availabilityName: (value) =>
      value === "out_of_stock"
        ? stockDict.outOfStock
        : value === "all"
          ? dict.allAvailability
          : stockDict[value],
  });

  /*
   * Built once and handed to whichever container the view switch chose. The
   * two layouts differ in how the cards are arranged, never in which cards
   * they are.
   */
  const cards = items.map((product) => {
    const category = categories.find((c) => c.id === product.categoryId);
    const brand = brands.find((b) => b.id === product.brandId);
    return (
      <ProductCard
        key={product.id}
        product={product}
        lang={lang}
        categoryName={category?.name[lang] ?? ""}
        brandName={brand?.name ?? ""}
        stock={stockDict}
        requestPriceLabel={requestPriceLabel}
        actions={actions}
        productDict={productDict}
        stats={stats?.[product.id]}
      />
    );
  });

  const panel = (
    <ProductFilters
      dict={dict}
      stockDict={stockDict}
      brands={brands}
      categories={categories}
      priceBounds={priceBounds}
      lang={lang}
      filters={filters}
      onChange={changeFilter}
      onClear={resetFilters}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:items-start lg:gap-10">
      {/*
        Sticky under the header, which stands three rows deep at the top of the
        page. The rail scrolls inside itself so a long brand list cannot push
        the grid down the screen.
      */}
      <aside className="hidden lg:sticky lg:top-40 lg:block lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto lg:pr-2">
        <h2 className="type-eyebrow border-b border-border pb-3 text-foreground">
          {dict.filtersTitle}
        </h2>
        <div className="mt-6">{panel}</div>
      </aside>

      <div className="min-w-0">
        <FilterChips
          className="mb-4"
          chips={chips}
          dict={dict}
          onRemove={(chip) => {
            setFilters((current) => removeFilter(current, chip));
            setPage(1);
          }}
          onClearAll={resetFilters}
          scope={
            scopeLabel
              ? { label: scopeLabel, clearLabel: clearScopeLabel ?? "" }
              : undefined
          }
        />

        <CatalogToolbar
          total={data?.total ?? 0}
          isFetching={isFetching}
          sortKey={sortKey}
          onSortChange={setSortKey}
          view={view}
          onViewChange={setView}
          dict={dict}
          filterSlot={
            <FilterDrawer
              className="lg:hidden"
              triggerLabel={dict.filtersOpen}
              title={dict.filtersTitle}
              closeLabel={dict.filtersClose}
              applyLabel={dict.filtersApply}
              activeCount={activeFilterCount(filters)}
            >
              {panel}
            </FilterDrawer>
          }
        />

        {isError ? (
          <div className="mt-12 text-center">
            <p className="text-sm text-muted">{dict.loadError}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-4 rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:border-accent/60 hover:text-accent-strong"
            >
              {dict.retry}
            </button>
          </div>
        ) : isPending ? (
          <p className="mt-12 text-center text-muted">{dict.loading}</p>
        ) : items.length === 0 ? (
          <p className="mt-12 text-center text-muted">{dict.noResults}</p>
        ) : view === "grid" ? (
          /*
            The one product surface that stays a grid all the way down.
            Everywhere else a set of cards is a row to glance along, so it
            becomes a horizontal track on a phone — see `ProductGrid`. This is
            the catalog: it is what the filters filter and what the pagination
            pages, and a page of results a reader has to swipe sideways through
            hides most of its own answer. Two columns is the smaller card, and
            here that is the right trade.
          */
          <div className="mt-6 grid grid-cols-2 gap-6 xl:grid-cols-3">{cards}</div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">{cards}</div>
        )}

        <Pagination
          className="mt-10"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
          labels={{
            nav: dict.paginationLabel,
            prev: dict.prevPage,
            next: dict.nextPage,
            indicator: dict.pageIndicator,
            page: dict.pageLabel,
          }}
        />
      </div>
    </div>
  );
}
