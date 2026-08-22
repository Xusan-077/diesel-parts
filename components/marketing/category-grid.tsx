import { listCategories } from "@/lib/api/product-repository";
import { safeRead } from "@/lib/api/safe-read";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import type { Locale } from "@/lib/i18n/locales";
import type { Category } from "@/lib/types";
import { CategoryMarquee } from "./category-marquee";

/**
 * Stays a server component: the read happens here, and only the belt below
 * reaches the browser. See `CategoryMarquee` for why a phone gets a travelling
 * row where a desktop gets the grid.
 */
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

  return <CategoryMarquee categories={categories.data} lang={lang} />;
}
