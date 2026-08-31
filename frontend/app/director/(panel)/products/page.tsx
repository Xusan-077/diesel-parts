import { Search } from "lucide-react";
import { listProductsForAdmin } from "@/lib/api/product-write-repository";
import { listBrands, listCategories } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { AdminProductListQuery } from "@/lib/schemas";
import { CatalogTransfer } from "@/components/admin/catalog-transfer";
import { PageHeader } from "@/components/admin/page-header";
import { ProductCatalog } from "@/components/admin/product-catalog";
import { Input } from "@/components/ui/shadcn/input";
import { SortSelect } from "@/components/director/sort-select";
import { ArchiveToggle } from "@/components/director/archive-toggle";
import { FilterBar, FilterField } from "@/components/director/filter-bar";

const SORTS = [
  { key: "stock", label: "Qoldiq bo'yicha" },
  { key: "name", label: "Nomi bo'yicha" },
  { key: "price", label: "Narx bo'yicha" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

function isSortKey(value: unknown): value is SortKey {
  return SORTS.some((sort) => sort.key === value);
}

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function DirectorProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = firstParam(params.q);
  const rawSort = firstParam(params.sort);
  const sort: SortKey = isSortKey(rawSort) ? rawSort : "stock";
  const includeInactive = firstParam(params.all) === "1";
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);

  /*
   * The URL, parsed once. The same object is the argument to the server read
   * and the table's React Query key, so what was rendered and what is cached
   * cannot describe two different listings.
   */
  const query: AdminProductListQuery = { q: search, page, all: includeInactive, sort };

  /*
   * The reference lists are fetched here rather than inside the dialog, so the
   * category combobox is populated the instant it opens. They are small — a few
   * hundred rows of id and name — and fetching them on open would put a spinner
   * in front of the one control the director came to the dialog to use.
   *
   * Each read degrades on its own. An unreachable database used to answer this
   * whole route with a 500; now the table falls back to fetching and shows its
   * own error, and the dialog opens with an empty combobox rather than not at
   * all.
   */
  const [result, categories, brands] = await Promise.all([
    safeRead("admin product list", () =>
      listProductsForAdmin({ search, page, includeInactive, sort }), undefined),
    safeRead("admin category options", listCategories, []),
    safeRead("admin brand options", listBrands, []),
  ]);

  const link = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (sort !== "stock") next.set("sort", sort);
    if (includeInactive) next.set("all", "1");
    for (const [key, value] of Object.entries(overrides)) {
      if (value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const query = next.toString();
    return "/director/products" + (query ? "?" + query : "");
  };

  return (
    <div>
      {/*
        * No count in the header: it is derived from the same listing as the
        * rows and now sits with them, so the two cannot disagree after a write.
        */}
      <PageHeader
        eyebrow="Direktor paneli"
        title="Mahsulotlar"
        description="Katalogdagi barcha mahsulotlar, qoldiqlari bilan."
      />

      <FilterBar>
        <FilterField label="SKU, nom yoki OEM raqami">
          <form method="get" className="flex items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
              />
              <Input
                id="q"
                name="q"
                defaultValue={search}
                className="h-9 w-64 pl-8 font-mono"
                placeholder="DP-INJ-3126"
              />
            </div>
            {sort !== "stock" ? <input type="hidden" name="sort" value={sort} /> : null}
            {includeInactive ? <input type="hidden" name="all" value="1" /> : null}
            <button
              type="submit"
              className="h-9 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-hover"
            >
              Qidirish
            </button>
          </form>
        </FilterField>

        <FilterField label="Saralash">
          <SortSelect
            value={sort}
            label="Saralash"
            options={SORTS.map((option) => ({
              value: option.key,
              label: option.label,
              href: link({ sort: option.key === "stock" ? "" : option.key, page: "" }),
            }))}
          />
        </FilterField>

        <FilterField label="Arxiv">
          <ArchiveToggle
            id="show-archived"
            checked={includeInactive}
            href={link({ all: includeInactive ? "" : "1", page: "" })}
            label="Arxivni ham ko'rsatish"
          />
        </FilterField>
      </FilterBar>

      <div className="mt-4">
        <CatalogTransfer />
      </div>

      <div className="mt-4">
        <ProductCatalog
          query={query}
          initialData={result.data}
          categories={categories.data.map((c) => ({ id: c.id, label: c.name.uz }))}
          brands={brands.data.map((b) => ({ id: b.id, label: b.name }))}
        />
      </div>

    </div>
  );
}
