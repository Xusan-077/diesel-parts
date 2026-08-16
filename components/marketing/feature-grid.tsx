import { cn } from "@/lib/utils";
import { FeatureIcon } from "./feature-icon";

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

export function FeatureGrid({
  items,
  className,
}: {
  items: readonly FeatureItem[];
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item) => (
        <li
          key={item.title}
          className="rounded-lg border border-border bg-surface-muted p-6 transition-colors hover:border-accent/50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent-strong">
            <FeatureIcon icon={item.icon} size="md" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}
