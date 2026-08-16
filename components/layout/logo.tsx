import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

export function Logo({
  lang,
  siteName,
  className,
}: {
  lang: Locale;
  siteName: string;
  className?: string;
}) {
  return (
    <Link
      href={`/${lang}`}
      className={cn("flex shrink-0 items-center gap-2", className)}
      aria-label={siteName}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
        {siteName.charAt(0)}
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">{siteName}</span>
    </Link>
  );
}
