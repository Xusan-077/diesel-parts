import { Search, Users } from "lucide-react";
import { requireDirector } from "@/lib/auth/dal";
import { listCustomers } from "@/lib/api/customer-repository";
import { safeRead } from "@/lib/api/safe-read";
import { PageHeader } from "@/components/admin/page-header";
import { PanelCard } from "@/components/director/panel-card";
import { Input } from "@/components/ui/shadcn/input";
import { CustomersTable } from "@/components/director/customers-table";
import { EmptyState } from "@/components/director/empty-state";
import { FilterBar, FilterField } from "@/components/director/filter-bar";

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * A director-facing customers overview — distinct from the seller's own
 * customer book at `/admin/seller/customers` (customer-book.tsx), which
 * sellers use daily to claim accounts and log notes. That page is left
 * untouched by this redesign; this one is read-oriented (spend, order count,
 * status across the whole book) rather than a claim workflow, which is the
 * job a director actually has here.
 */
export default async function DirectorCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const director = await requireDirector();
  const params = await searchParams;
  const search = firstParam(params.q);
  const page = Math.max(1, Number.parseInt(firstParam(params.page), 10) || 1);

  const result = await safeRead(
    "director customer list",
    () => listCustomers(director, { search: search || undefined, pool: false, page }),
    { items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
  );

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Mijozlar"
        description="Barcha mijozlar, buyurtmalar soni va xarid summasi bilan."
      />

      <div className="mt-8">
        <FilterBar>
          <FilterField label="Ism, telefon yoki kompaniya">
            <form method="get" className="max-w-sm">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted"
                />
                <Input
                  id="q"
                  name="q"
                  defaultValue={search}
                  className="h-9 w-64 pl-8"
                  placeholder="Qidirish..."
                />
              </div>
            </form>
          </FilterField>
        </FilterBar>
      </div>

      <div className="mt-4">
        <PanelCard title="Mijozlar" meta={String(result.data.total)}>
          {result.data.items.length === 0 ? (
            <EmptyState icon={Users} message="Hech narsa topilmadi." />
          ) : (
            <CustomersTable rows={result.data.items} />
          )}
        </PanelCard>
      </div>
    </div>
  );
}
