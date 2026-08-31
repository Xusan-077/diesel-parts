import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * The rule that closes a product row.
 *
 * Three carousels stacked down the home page run together: each is a
 * left-aligned heading over a horizontal track, so from halfway down the page
 * there is nothing that says where one collection ended and the next began.
 * This is that boundary — a hairline across the column with the collection's
 * name set into it.
 *
 * It repeats the heading above deliberately, the way a running foot repeats a
 * chapter title: it marks the end of something you have just read, at the
 * moment you have scrolled its heading off the screen. Making it a link is
 * what stops it being pure decoration — a reader who has just scanned twelve
 * popular parts and wants the rest finds the way in exactly where they
 * stopped, rather than scrolling back up to the row's own "see all".
 *
 * Hidden from assistive tech, and its link taken out of the tab order with
 * it — an `aria-hidden` element that can still be focused is a trap. Nothing
 * is lost: the label repeats the heading above and the link repeats that row's
 * own "see all", both of which are already announced and reachable. This is a
 * shortcut for the eye and the pointer.
 */
export function SectionMarker({
  label,
  href,
  className,
}: {
  label: string;
  href: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)} aria-hidden>
      <span className="h-px flex-1 bg-border" />
      <Link
        href={href}
        tabIndex={-1}
        className="group type-eyebrow flex items-center gap-1.5 whitespace-nowrap text-muted transition-colors hover:text-accent-strong"
      >
        {label}
        <Icon
          icon={ArrowRight}
          size="xs"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      </Link>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
