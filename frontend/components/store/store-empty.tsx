import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function StoreEmpty({
  icon: glyph,
  message,
  ctaHref,
  ctaLabel,
}: {
  icon: LucideIcon;
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-border bg-surface px-6 py-16 text-center">
      <Icon icon={glyph} size="xl" className="text-muted" />
      <p className="mt-4 text-sm text-muted">{message}</p>
      <Link
        href={ctaHref}
        className="mt-6 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
