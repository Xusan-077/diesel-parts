import { WarehouseSubnav } from "@/components/director/warehouse/warehouse-subnav";
import { WarehousePageTransition } from "@/components/director/warehouse/warehouse-page-transition";

/**
 * The warehouse module's frame: one page header per screen (each page draws
 * its own), a shared second row of tabs, and a short entrance as pages swap.
 *
 * The route guard is the panel layout above this one (`requireDirector`); this
 * adds nothing to it — every warehouse read is `SELLER_UP` and every write
 * `MANAGER_UP` on `backend/`, and a director clears both.
 */
export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <WarehouseSubnav />
      <div className="mt-8">
        <WarehousePageTransition>{children}</WarehousePageTransition>
      </div>
    </div>
  );
}
