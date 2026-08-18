import { brands } from "@/prisma/seed-data/brands";
import type { Locale } from "@/lib/i18n/locales";
import { BrandLogo } from "./brand-logo";

export function BrandGrid({ lang }: { lang: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
      {brands.map((brand) => (
        <BrandLogo key={brand.id} brand={brand} lang={lang} />
      ))}
    </div>
  );
}
