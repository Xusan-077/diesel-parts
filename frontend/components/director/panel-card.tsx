import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/shadcn/card";

/** Same control as `components/admin/panel-section.tsx`'s, on a shadcn `Card`. */
export function SeeAllLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group type-label inline-flex items-center gap-1 text-accent-strong transition-colors hover:text-foreground"
    >
      {label}
      <ArrowRight aria-hidden="true" className="size-3 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * `PanelSection` (components/admin/panel-section.tsx), redrawn as a shadcn
 * `Card` — same title/description/meta/action/children contract, so the
 * dashboard's sections can move to it one at a time without a second prop
 * shape to learn. Kept as a distinct component rather than editing
 * `PanelSection` in place: that component is shared by every other director
 * and admin page (analytics, audit, categories, discounts, reviews, users),
 * none of which this redesign's scope covers.
 */
export function PanelCard({
  title,
  description,
  meta,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("h-full min-w-0 gap-0 py-6", className)}>
      <CardHeader className="grid-rows-1 gap-1 pb-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="type-title text-foreground">{title}</h2>
          {meta || action ? (
            <div className="flex items-center gap-3">
              {meta ? (
                <p className="type-eyebrow inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-muted">
                  {meta}
                </p>
              ) : null}
              {action}
            </div>
          ) : null}
        </div>
        {description ? <p className="type-caption text-muted">{description}</p> : null}
      </CardHeader>

      <CardContent className={cn("mt-6 min-w-0 flex-1", bodyClassName)}>{children}</CardContent>
    </Card>
  );
}
