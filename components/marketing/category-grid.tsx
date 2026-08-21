import { listCategories } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import type { Locale } from "@/lib/i18n/locales";
import type { Category } from "@/lib/types";
import { CategoryCard } from "./category-card";

export async function CategoryGrid({
  lang,
  unavailableLabel,
}: {
  lang: Locale;
  unavailableLabel: string;
}) {
  const categories = await safeRead("category grid", listCategories, [] as Category[]);

  if (!categories.ok) {
    return <DataUnavailable message={unavailableLabel} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {categories.data.map((category) => (
        <CategoryCard key={category.id} category={category} lang={lang} />
      ))}
    </div>
  );
}
