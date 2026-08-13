"use client";

import { useMemo, useState } from "react";
import { products } from "@/lib/data/products";
import { categories } from "@/lib/data/categories";
import { brands } from "@/lib/data/brands";
import { filterProducts, sortProducts, type AvailabilityFilter, type SortKey } from "@/lib/filters";
import type { Locale } from "@/lib/i18n/locales";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ProductFilters } from "./product-filters";
import { ProductCard } from "@/components/marketing/product-card";

const PAGE_SIZE = 9;

interface ProductCatalogClientProps {
  lang: Locale;
  dict: Dictionary["catalog"];
  stockDict: Dictionary["common"]["stock"];
  requestPriceLabel: string;
}

export function ProductCatalogClient({
  lang,
  dict,
  stockDict,
  requestPriceLabel,
}: ProductCatalogClientProps) {
  const [search, setSearch] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [availability, setAvailability] = useState<AvailabilityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const result = filterProducts(products, { search, brandId, categoryId, availability }, lang);
    return sortProducts(result, sortKey, lang);
  }, [search, brandId, categoryId, availability, sortKey, lang]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function withPageReset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div>
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

      <p className="mt-6 text-sm text-muted">{dict.resultsCount.replace("{count}", String(filtered.length))}</p>

      {pageItems.length === 0 ? (
        <p className="mt-12 text-center text-muted">{dict.noResults}</p>
      ) : (
        <div className={view === "grid" ? "mt-6 grid grid-cols-2 gap-6 lg:grid-cols-3" : "mt-6 flex flex-col gap-4"}>
          {pageItems.map((product) => {
            const category = categories.find((c) => c.id === product.categoryId)!;
            const brand = brands.find((b) => b.id === product.brandId)!;
            return (
              <ProductCard
                key={product.id}
                product={product}
                lang={lang}
                categoryName={category.name[lang]}
                brandName={brand.name}
                stock={stockDict}
                requestPriceLabel={requestPriceLabel}
              />
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-muted">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="disabled:opacity-40"
          >
            {dict.prevPage}
          </button>
          <span>{dict.pageIndicator.replace("{current}", String(currentPage)).replace("{total}", String(totalPages))}</span>
          <button
            type="button"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="disabled:opacity-40"
          >
            {dict.nextPage}
          </button>
        </div>
      )}
    </div>
  );
}
