import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center">
      <Icon className="h-8 w-8 text-muted" />
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
    </div>
  );
}
