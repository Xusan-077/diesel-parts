import type { LucideIcon } from "lucide-react";

/** One shape for "nothing here" everywhere a table or list can come back empty. */
export function EmptyState({ icon: IconCmp, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
        <IconCmp aria-hidden="true" className="size-5" />
      </span>
      <p className="type-body text-muted">{message}</p>
    </div>
  );
}
