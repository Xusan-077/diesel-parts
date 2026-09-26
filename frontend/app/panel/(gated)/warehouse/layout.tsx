import { requirePermission } from "@/lib/auth/dal";
import { WarehouseSubnav } from "@/components/director/warehouse/warehouse-subnav";
import { WarehousePageTransition } from "@/components/director/warehouse/warehouse-page-transition";

/**
 * The warehouse module's frame: one page header per screen (each page draws
 * its own), a shared second row of tabs, and a short entrance as pages swap.
 *
 * The route guard: `warehouse:read`, which both roles hold — the spec grants
 * SELLER read-only warehouse access. Writes stay director-only at the
 * backend (`warehouse:create`/`update`); the pages/components below hide
 * their own create/edit controls for a SELLER (see e.g.
 * goods-receipts-table.tsx's `canWrite` prop).
 */
export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  await requirePermission("warehouse:read");

  return (
    <div>
      <WarehouseSubnav />
      <div className="mt-8">
        <WarehousePageTransition>{children}</WarehousePageTransition>
      </div>
    </div>
  );
}
