import type { ReactNode } from "react";

/**
 * The filter/search row a list page opens with, drawn as one recessed strip
 * instead of controls floating loose on the page — the same device the
 * director panel uses (components/director/filter-bar.tsx), so "these are the
 * things that change what you're looking at" reads as one group in both.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-lg border border-border bg-surface-muted/60 p-4">
      {children}
    </div>
  );
}

export function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="type-eyebrow text-muted">{label}</span>
      {children}
    </div>
  );
}
