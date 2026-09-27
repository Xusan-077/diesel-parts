import { listBrandsForAdmin } from "@/lib/api/brand-repository";
import { safeRead } from "@/lib/api/safe-read";
import { requirePermission } from "@/lib/auth/dal";
import { PageHeader } from "@/components/admin/page-header";
import { BrandManager } from "@/components/admin/brand-manager";

export default async function BrandsPage() {
  const user = await requirePermission("products:read");
  const brands = await safeRead("admin brand list", listBrandsForAdmin, undefined);

  return (
    <div>
      <PageHeader
        eyebrow="Direktor paneli"
        title="Brendlar"
        description="Mahsulotlarga bog'lanadigan brendlar ro'yxati."
      />

      <div className="mt-8">
        <BrandManager initialData={brands.data} canDelete={user.role === "DIRECTOR"} />
      </div>
    </div>
  );
}
