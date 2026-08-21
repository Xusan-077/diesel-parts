"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { SortKey } from "@/lib/filters";
import { fetchProducts, productsQueryKey, type ProductListParams } from "@/lib/api/products";
import { DEFAULT_PAGE_SIZE, type ProductPage } from "@/lib/api/product-query";
import {
  activeFilterCount,
  clearFilters,
  DEFAULT_FILTERS,
  type CatalogFilters,
} from "@/lib/catalog-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Brand, Category, Product } from "@/lib/types";
import { ProductFilters } from "./product-filters";
import { FilterDrawer } from "./filter-drawer";
import { CatalogToolbar } from "./catalog-toolbar";
import { ProductCard } from "@/components/marketing/product-card";
import { Pagination } from "@/components/ui/pagination";
import { Icon } from "@/components/ui/icon";

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

  const debouncedSearch = useDebouncedValue(filters.search);

  const params: ProductListParams = {
    q: debouncedSearch,
    brandId: filters.brandId,
    categoryId: filters.categoryId,
    categoryIds: scopeCategoryIds,
    availability: filters.availability,
    sort: sortKey,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    lang,
  };

  // Only the untouched first render matches what the server already computed.
  const isInitialParams =
    debouncedSearch === initialSearch &&
    filters.brandId === "all" &&
    filters.categoryId === "all" &&
    filters.availability === "all" &&
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

  const panel = (
    <ProductFilters
      dict={dict}
      stockDict={stockDict}
      brands={brands}
      categories={categories}
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
        {scopeLabel ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-1 text-sm text-accent-strong">
              {scopeLabel}
              <Link
                href="/products"
                aria-label={clearScopeLabel}
                title={clearScopeLabel}
                className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent/20"
              >
                <Icon icon={X} size="xs" />
              </Link>
            </span>
          </div>
        ) : null}

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
        ) : (
          <div
            className={
              view === "grid"
                ? "mt-6 grid grid-cols-2 gap-6 xl:grid-cols-3"
                : "mt-6 flex flex-col gap-4"
            }
          >
            {items.map((product) => {
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
            })}
          </div>
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
