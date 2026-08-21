import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  siteName,
  className,
}: {
  siteName: string;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={cn("flex shrink-0 items-center gap-2", className)}
      aria-label={siteName}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
        {siteName.charAt(0)}
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">{siteName}</span>
    </Link>
  );
}
