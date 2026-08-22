import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";

/*
 * The header lockup: the mark, then the name.
 *
 * The mark used to be the site name's first letter in an accent-filled
 * circle -- a placeholder from before there was any artwork. The real mark is
 * wider than it is tall, so the lockup is sized by height and left to find
 * its own width; pinning it to a square is what made the placeholder look
 * like a placeholder.
 *
 * `text-chrome-foreground` is doing two jobs here: it sets the name, and it
 * is what the mark's lower half reads through `currentColor`.
 */
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
      className={cn("flex shrink-0 items-center gap-2 text-chrome-foreground", className)}
      aria-label={siteName}
    >
      <BrandMark className="h-8" />
      <span className="text-lg font-semibold tracking-tight">{siteName}</span>
    </Link>
  );
}
