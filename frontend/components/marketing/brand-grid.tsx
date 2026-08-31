import { listBrands } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import type { Brand } from "@/lib/types";
import { BrandLogo } from "./brand-logo";

export async function BrandGrid({ unavailableLabel }: { unavailableLabel: string }) {
  const brands = await safeRead("brand grid", listBrands, [] as Brand[]);

  // Only a failed read earns the notice; a catalog with no brands yet simply
  // shows an empty grid, as it always did.
  if (!brands.ok) {
    return <DataUnavailable message={unavailableLabel} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {brands.data.map((brand) => (
        <BrandLogo key={brand.id} brand={brand} />
      ))}
    </div>
  );
}
