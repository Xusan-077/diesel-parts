import Link from "next/link";
import type { Brand } from "@/lib/types";

export function BrandLogo({ brand }: { brand: Brand }) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="flex h-20 items-center justify-center rounded-lg border border-border bg-surface text-lg font-semibold tracking-wide text-muted transition-colors hover:border-accent/60 hover:text-foreground"
    >
      {brand.name}
    </Link>
  );
}
