import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CountUp } from "./count-up";

/**
 * The four claims under the hero: how long, how many, how far, how good.
 *
 * Two of them open with a figure and two do not, and `CountUp` handles that
 * itself — a badge with no number in its line renders as plain text and never
 * mounts a timer. Which two carry figures is a property of the copy, and a
 * translator must be free to change it without touching this file.
 */
export function TrustBadges({ items }: { items: Dictionary["home"]["trustBadges"] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-lg border border-border bg-surface-muted p-6 transition-colors hover:border-border-strong"
        >
          <CountUp
            label={item.title}
            className="block text-base font-semibold text-foreground"
          />
          <p className="mt-2 text-sm text-muted">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
