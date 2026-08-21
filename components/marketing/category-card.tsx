import Link from "next/link";
import type { Category } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function CategoryCard({ category, lang }: { category: Category; lang: Locale }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-muted px-4 py-8 text-center transition-colors hover:border-accent/60"
    >
      <span className="text-sm font-medium text-foreground">{category.name[lang]}</span>
    </Link>
  );
}
