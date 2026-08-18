"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import type { AvailabilityFilter, SortKey } from "@/lib/filters";
import { fetchProducts, productsQueryKey, type ProductListParams } from "@/lib/api/products";
import { DEFAULT_PAGE_SIZE, type Page } from "@/lib/api/product-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Brand, Category, Product } from "@/lib/types";
import { ProductFilters } from "./product-filters";
import { ProductCard } from "@/components/marketing/product-card";
import { Pagination } from "@/components/ui/pagination";
import { Icon } from "@/components/ui/icon";

interface ProductCatalogClientProps {
  lang: Locale;
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  requestPriceLabel: string;
  actions: Dictionary["productActions"];
  /** Filter reference data, read from the database by the server page. */
  categories: Category[];
  brands: Brand[];
  /** Seeded from the `?q=` param so the header search lands on real results. */
  initialSearch?: string;
  /**
   * Category ids the catalog menu scoped this page to via `?group=`/`?category=`.
   * `undefined` means no scope; an empty array is a scope with no products yet.
   */
  scopeCategoryIds?: string[];
  /** Localised name of that scope, shown as a removable chip above the grid. */
  scopeLabel?: string;
  clearScopeLabel?: string;
  /** First page rendered on the server, so there is no loading flash on entry. */
  initialData: Page<Product>;
}

export function ProductCatalogClient({
  lang,
  dict,
  stockDict,
  requestPriceLabel,
  actions,
  categories,
  brands,
  initialSearch = "",
  scopeCategoryIds,
  scopeLabel,
  clearScopeLabel,
  initialData,
}: ProductCatalogClientProps) {
  const [search, setSearch] = useState(initialSearch);
  const [brandId, setBrandId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const params: ProductListParams = {
    q: debouncedSearch,
    brandId,
    categoryId,
    categoryIds: scopeCategoryIds,
    availability,
    sort: sortKey,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    lang,
  };

  // Only the untouched first render matches what the server already computed.
  const isInitialParams =
    debouncedSearch === initialSearch &&
    brandId === "all" &&
    categoryId === "all" &&
    availability === "all" &&
    sortKey === "newest" &&
    page === 1;

  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: productsQueryKey(params),
    queryFn: () => fetchProducts(params),
    initialData: isInitialParams ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  function withPageReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;

  return (
    <div>
      {scopeLabel ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 py-1 pl-3 pr-1 text-sm text-accent-strong">
            {scopeLabel}
            <Link
              href={`/${lang}/products`}
              aria-label={clearScopeLabel}
              title={clearScopeLabel}
              className="flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-accent/20"
            >
              <Icon icon={X} size="xs" />
            </Link>
          </span>
        </div>
      ) : null}

      <ProductFilters
        dict={dict}
        stockDict={stockDict}
        brands={brands}
        categories={categories}
        lang={lang}
        search={search}
        onSearchChange={withPageReset(setSearch)}
        brandId={brandId}
        onBrandChange={withPageReset(setBrandId)}
        categoryId={categoryId}
        onCategoryChange={withPageReset(setCategoryId)}
        availability={availability}
        onAvailabilityChange={withPageReset(setAvailability)}
        sortKey={sortKey}
        onSortChange={setSortKey}
        view={view}
        onViewChange={setView}
      />

      <div className="mt-6 flex items-center gap-3">
        <p className="text-sm text-muted">
          {dict.resultsCount.replace("{count}", String(data?.total ?? 0))}
        </p>
        {isFetching ? (
          <Icon
            icon={Loader2}
            aria-hidden={false}
            aria-label={dict.loading}
            className="animate-spin text-muted"
          />
        ) : null}
      </div>

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
              ? "mt-6 grid grid-cols-2 gap-6 lg:grid-cols-3"
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
  );
}
