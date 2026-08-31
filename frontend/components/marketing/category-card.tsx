import Link from "next/link";
import type { Category } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function CategoryCard({
  category,
  lang,
  /**
   * `false` on the marquee's duplicate copy.
   *
   * The loop needs the second copy pixel for pixel; a screen reader and the
   * keyboard need it not to exist. Rendering it as a plain box keeps the
   * width identical and takes the tab stop away with the link.
   */
  interactive = true,
}: {
  category: Category;
  lang: Locale;
  interactive?: boolean;
}) {
  const className =
    "flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-8 text-center transition-colors hover:border-accent/60";
  const label = <span className="text-sm font-medium text-foreground">{category.name[lang]}</span>;

  if (!interactive) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link href={`/categories/${category.slug}`} className={className}>
      {label}
    </Link>
  );
}
