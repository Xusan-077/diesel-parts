import type { ProductSpec } from "@/lib/types";
import type { Locale } from "@/lib/i18n/locales";

export function SpecsTable({
  specs,
  lang,
  title,
}: {
  specs: ProductSpec[];
  lang: Locale;
  title: string;
}) {
  if (specs.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <dl className="mt-3 divide-y divide-border border-y border-border">
        {specs.map((spec) => (
          <div key={spec.label[lang]} className="flex justify-between py-2 text-sm">
            <dt className="text-muted">{spec.label[lang]}</dt>
            <dd className="text-foreground">{spec.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
