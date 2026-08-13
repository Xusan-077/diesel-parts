import type { Dictionary } from "@/lib/i18n/dictionaries";

export function TrustBadges({ items }: { items: Dictionary["home"]["trustBadges"] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border border-border bg-white/2 p-6">
          <p className="text-base font-semibold text-foreground">{item.title}</p>
          <p className="mt-2 text-sm text-muted">{item.description}</p>
        </div>
      ))}
    </div>
  );
}
