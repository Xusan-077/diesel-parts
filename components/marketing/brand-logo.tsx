import Link from "next/link";
import type { Brand } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function BrandLogo({ brand, lang }: { brand: Brand; lang: Locale }) {
  return (
    <Link
      href={`/${lang}/brands/${brand.slug}`}
      className="flex h-20 items-center justify-center rounded-lg border border-border bg-white/2 text-lg font-semibold tracking-wide text-muted transition-colors hover:border-accent/60 hover:text-foreground"
    >
      {brand.name}
    </Link>
  );
}
