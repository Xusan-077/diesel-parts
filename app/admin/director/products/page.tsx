import Link from "next/link";
import { listProductsForAdmin } from "@/lib/api/product-write-repository";
import { listBrands, listCategories } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { AdminProductListQuery } from "@/lib/schemas";
import { controlVariants, fieldRail } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";
import { CatalogTransfer } from "@/components/admin/catalog-transfer";
import { PageHeader } from "@/components/admin/page-header";
import { ProductCatalog } from "@/components/admin/product-catalog";

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
    return "/admin/director/products" + (query ? "?" + query : "");
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

      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-4">
        <form method="get" className="flex items-end gap-2">
          <div className={fieldRail({ className: "pl-3" })}>
            <label htmlFor="q" className="block text-xs text-muted">
              SKU, nom yoki OEM raqami
            </label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              className={cn(
                controlVariants({ variant: "rail" }),
                "mt-1 h-9 w-64 font-mono",
              )}
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

        {/*
          * The same segmented control as the dashboard's period selector, with
          * one deliberate difference: the selected chip is raised (level 1 on
          * the recessed track) rather than filled with the accent. Sorting is
          * not the screen's primary choice, and a page with two orange fills on
          * it has no primary choice at all.
          */}
        <nav
          aria-label="Tartib"
          className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-1"
        >
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={link({ sort: option.key === "stock" ? "" : option.key, page: "" })}
              aria-current={option.key === sort ? "true" : undefined}
              className={
                "inline-flex h-7 items-center rounded-sm px-3 text-xs transition-colors " +
                (option.key === sort
                  ? "border border-border bg-surface font-medium text-foreground shadow-xs"
                  : "border border-transparent text-muted hover:bg-surface-hover hover:text-foreground")
              }
            >
              {option.label}
            </Link>
          ))}
        </nav>

        <Link
          href={link({ all: includeInactive ? "" : "1", page: "" })}
          className="text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          {includeInactive ? "Faqat faollarini ko'rsatish" : "Arxivni ham ko'rsatish"}
        </Link>
      </div>

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
