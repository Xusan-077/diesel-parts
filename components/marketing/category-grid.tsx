import { categories } from "@/lib/data/categories";
import type { Locale } from "@/lib/i18n/locales";
import { CategoryCard } from "./category-card";

export function CategoryGrid({ lang }: { lang: Locale }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} lang={lang} />
      ))}
    </div>
  );
}
