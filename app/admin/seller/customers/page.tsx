import Link from "next/link";
import { requireStaff } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/api/customer-repository";
import { controlVariants, fieldRail } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";
import { formatInteger } from "@/lib/analytics/format";
import { formatArrival } from "@/lib/admin/inquiry-board-state";
import { CustomerAdd } from "@/components/admin/customer-add";
import { CustomerBookEmpty } from "@/components/admin/customer-book-empty";

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * The seller's customer book.
 *
 * Scoped in `listCustomers` rather than here — `customerReadScope` is the one
 * place that answers who may see which row, and a page that filtered again
 * would be a second copy of the rule that could drift from it. What this page
 * decides is only which of the two lists it is asking for: the seller's own
 * book, or the unassigned pool they may claim from.
 */
export default async function SellerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const params = await searchParams;

  const search = firstParam(params.q);
  const pool = firstParam(params.pool) === "1";
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);

  const result = await listCustomers(user, { search: search || undefined, pool, page });

  const link = (overrides: Record<string, string>) => {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (pool) next.set("pool", "1");
    for (const [key, value] of Object.entries(overrides)) {
      if (value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    const query = next.toString();
    return "/admin/seller/customers" + (query ? "?" + query : "");
  };

  /*
   * "Nothing here" and "nothing matched" are different answers and get
   * different screens: the illustrated empty state belongs to a seller whose
   * book has not started, not to one whose search was too narrow.
   */
  const searching = search !== "";
  const showIllustration = result.total === 0 && !searching && !pool;

  const tabs = [
    { href: link({ pool: "", page: "" }), label: "Mening mijozlarim", active: !pool },
    { href: link({ pool: "1", page: "" }), label: "Egasiz", active: pool },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-muted">
            Sotuvchi paneli
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Mijozlar</h1>
          <p className="mt-1 text-sm text-muted">
            {pool
              ? `${formatInteger(result.total)} ta egasiz mijoz`
              : `${formatInteger(result.total)} ta mijoz kitobingizda`}
          </p>
        </div>

        <CustomerAdd />
      </div>

      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-4">
        <form method="get" className="flex items-end gap-2">
          <div className={fieldRail({ className: "pl-3" })}>
            <label htmlFor="q" className="block text-xs text-muted">
              Ism, telefon yoki kompaniya
            </label>
            <input
              id="q"
              name="q"
              defaultValue={search}
              className={cn(
                controlVariants({ variant: "rail" }),
                "mt-1 h-9 w-64",
              )}
              placeholder="+998 90 …"
            />
          </div>
          {pool ? <input type="hidden" name="pool" value="1" /> : null}
          <button
            type="submit"
            className="h-9 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-hover"
          >
            Qidirish
          </button>
        </form>

        {/* The pool is a separate list, not a filter on this one: a seller's
            book should stay their own working set rather than everybody's
            leftovers mixed into it. */}
        <nav aria-label="Ro'yxat" className="flex items-center gap-1">
          {tabs.map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={
                "rounded px-2.5 py-1 text-xs transition-colors " +
                (tab.active
                  ? "bg-surface-muted font-medium text-foreground"
                  : "text-muted hover:text-foreground")
              }
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {showIllustration ? (
        <div className="mt-8">
          <CustomerBookEmpty />
        </div>
      ) : result.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {searching
            ? "Bu so'rov bo'yicha mijoz topilmadi. Raqamni boshqacha yozib ko'ring."
            : "Hozircha egasiz mijoz yo'q."}
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="pb-2 font-medium text-muted">
                  Mijoz
                </th>
                <th scope="col" className="pb-2 font-medium text-muted">
                  Telefon
                </th>
                <th scope="col" className="pb-2 font-medium text-muted">
                  Kompaniya
                </th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">
                  Buyurtma
                </th>
                <th scope="col" className="pb-2 text-right font-medium text-muted">
                  Oxirgi o&apos;zgarish
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((customer) => (
                <tr key={customer.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3">
                    <Link
                      href={"/admin/seller/customers/" + customer.id}
                      className="text-foreground transition-colors hover:text-accent-strong"
                    >
                      {customer.name}
                    </Link>
                    {/* A director reads this list across the whole team, so the
                        owner is what tells them whose row they are looking at.
                        A seller's own book is all theirs and needs no column. */}
                    {user.role === "DIRECTOR" && customer.assignedSellerName !== null ? (
                      <span className="ml-2 text-xs text-muted">
                        {customer.assignedSellerName}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-xs tabular-nums text-muted">
                    {customer.phone}
                  </td>
                  <td className="py-2.5 pr-3 text-muted">{customer.company ?? "—"}</td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-foreground">
                    {formatInteger(customer.orderCount)}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono text-xs tabular-nums text-muted">
                    {formatArrival(customer.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.totalPages > 1 ? (
        <nav aria-label="Sahifalar" className="mt-8 flex items-center gap-3 text-sm">
          {result.page > 1 ? (
            <Link
              href={link({ page: String(result.page - 1) })}
              className="text-muted transition-colors hover:text-foreground"
            >
              ← Oldingi
            </Link>
          ) : null}
          <span className="font-mono text-xs tabular-nums text-muted">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link
              href={link({ page: String(result.page + 1) })}
              className="text-muted transition-colors hover:text-foreground"
            >
              Keyingi →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
