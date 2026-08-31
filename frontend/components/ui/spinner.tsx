import { cn } from "@/lib/utils";

/**
 * The one busy mark: a ring with a quarter cut out of it, spinning.
 *
 * Drawn in `currentColor` so it inherits whatever it is placed on — the label
 * colour inside a filled button, the muted colour beside a table row — rather
 * than carrying a palette decision of its own.
 *
 * `motion-reduce:animate-none` leaves the ring visible but still. That is the
 * right degradation: the shape already reads as "waiting" because the gap in
 * it is not a shape anything else on the panel uses, so a reader who asked for
 * less motion loses the spin and keeps the information.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none",
        className,
      )}
    />
  );
}
