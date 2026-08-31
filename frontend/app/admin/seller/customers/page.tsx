import Link from "next/link";
import { requireStaff } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/api/customer-repository";
import { safeRead } from "@/lib/api/safe-read";
import type { CustomerListQuery } from "@/lib/schemas";
import { controlVariants, fieldRail } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";
import { CustomerAdd } from "@/components/admin/customer-add";
import { CustomerBook } from "@/components/admin/customer-book";
import { PageHeader } from "@/components/admin/page-header";

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
 *
 * The read below seeds the table, which owns it from there: adding a customer
 * or claiming one invalidates that cache rather than re-running this route.
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

  /*
   * The URL, parsed once, then used twice: as the argument to the read and as
   * the table's cache key, so what was rendered and what is cached cannot
   * describe two different lists.
   */
  const query: CustomerListQuery = { search: search || undefined, pool, page };

  const result = await safeRead(
    "seller customer book",
    async () => {
      const listed = await listCustomers(user, query);
      return {
        ...listed,
        // The wire form: JSON has no Date, so the seed has to be what a
        // refetch would return.
        items: listed.items.map((customer) => ({
          ...customer,
          createdAt: customer.createdAt.toISOString(),
          updatedAt: customer.updatedAt.toISOString(),
        })),
      };
    },
    undefined,
  );

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
    const querystring = next.toString();
    return "/admin/seller/customers" + (querystring ? "?" + querystring : "");
  };

  const tabs = [
    { href: link({ pool: "", page: "" }), label: "Mening mijozlarim", active: !pool },
    { href: link({ pool: "1", page: "" }), label: "Egasiz", active: pool },
  ];

  return (
    <div>
      {/*
        No count in the header: it is derived from the same listing as the rows
        and now sits with them, so the two cannot disagree after a write.
      */}
      <PageHeader
        eyebrow="Sotuvchi paneli"
        title="Mijozlar"
        description="Mijozlar kitobi va egasiz hisoblar."
        actions={<CustomerAdd />}
      />

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
                "rounded px-3 py-1 text-xs transition-colors " +
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

      <CustomerBook
        query={query}
        initialData={result.data}
        showOwner={user.role === "DIRECTOR"}
      />
    </div>
  );
}
