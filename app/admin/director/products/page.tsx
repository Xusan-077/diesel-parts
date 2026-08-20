import Link from "next/link";
import { listProductsForAdmin } from "@/lib/api/product-write-repository";
import { formatInteger, formatSum } from "@/lib/analytics/format";
import { controlVariants, fieldRail } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";
import { CatalogTransfer } from "@/components/admin/catalog-transfer";

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

  const result = await listProductsForAdmin({ search, page, includeInactive, sort });

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-muted">
            Direktor paneli
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Mahsulotlar
          </h1>
          <p className="mt-1 text-sm text-muted">
            {formatInteger(result.total)} ta mahsulot
            {includeInactive ? " (arxiv bilan)" : ""}
          </p>
        </div>

        <Link
          href="/admin/director/products/new"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
        >
          Yangi mahsulot
        </Link>
      </div>

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

        <nav aria-label="Tartib" className="flex items-center gap-1">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={link({ sort: option.key === "stock" ? "" : option.key, page: "" })}
              aria-current={option.key === sort ? "true" : undefined}
              className={
                "rounded px-2.5 py-1 text-xs transition-colors " +
                (option.key === sort
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted hover:text-foreground")
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

      <div className="mt-6">
        <CatalogTransfer />
      </div>

      <div className="mt-8 overflow-x-auto">
        {result.items.length === 0 ? (
          <p className="text-sm text-muted">
            Hech narsa topilmadi. Qidiruvni o&apos;zgartiring yoki yangi mahsulot qo&apos;shing.
          </p>
        ) : (
          <table className="w-full min-w-4xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 font-medium text-muted">Mahsulot</th>
                <th scope="col" className="pb-2 font-medium text-muted">SKU</th>
                <th scope="col" className="pb-2 font-medium text-muted">Brend</th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">Narx</th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">Qoldiq</th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">Holat</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((product) => {
                const short = product.stock <= product.minStock;
                return (
                  <tr key={product.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={"/admin/director/products/" + product.id}
                        className="text-foreground transition-colors hover:text-accent-strong"
                      >
                        {product.name}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{product.categoryName}</span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-muted">{product.sku}</td>
                    <td className="py-2.5 pr-3 text-muted">{product.brandName}</td>
                    <td className="py-2.5 text-right font-mono tabular-nums text-foreground">
                      {product.price === null ? (
                        <span className="text-muted">so&apos;rov bo&apos;yicha</span>
                      ) : (
                        formatSum(product.price)
                      )}
                    </td>
                    <td
                      className={
                        "py-2.5 pl-3 text-right font-mono tabular-nums " +
                        (product.stock === 0
                          ? "text-danger"
                          : short
                            ? "text-warning"
                            : "text-foreground")
                      }
                    >
                      {formatInteger(product.stock)}
                      <span className="ml-1 text-muted">/ {formatInteger(product.minStock)}</span>
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {product.isActive ? (
                        <span className="text-xs text-muted">faol</span>
                      ) : (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">
                          arxiv
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link href={link({ page: String(result.page - 1) })} className="text-muted hover:text-foreground">
              ← Oldingi
            </Link>
          ) : null}
          <span className="font-mono text-xs text-muted">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={link({ page: String(result.page + 1) })} className="text-muted hover:text-foreground">
              Keyingi →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
