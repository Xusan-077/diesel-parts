/**
 * The 14 first-level administrative units of Uzbekistan, plus Tashkent city.
 *
 * A closed, rarely-changing list — so it lives here as a constant rather than
 * behind an endpoint. The `value` is a stable slug stored in the checkout form
 * and resolved to its label by the proxy route before the order is sent to
 * backend/ (whose CreateCheckoutDto stores `region` as a free string — see
 * app/api/v1/checkout/route.ts). Labels are proper nouns and read the same in
 * every locale, so there is one label per region, not three.
 */
export interface UzRegion {
  value: string;
  label: string;
}

export const UZ_REGIONS: readonly UzRegion[] = [
  { value: "tashkent-city", label: "Toshkent shahri" },
  { value: "tashkent", label: "Toshkent viloyati" },
  { value: "andijan", label: "Andijon viloyati" },
  { value: "bukhara", label: "Buxoro viloyati" },
  { value: "fergana", label: "Farg‘ona viloyati" },
  { value: "jizzakh", label: "Jizzax viloyati" },
  { value: "kashkadarya", label: "Qashqadaryo viloyati" },
  { value: "khorezm", label: "Xorazm viloyati" },
  { value: "namangan", label: "Namangan viloyati" },
  { value: "navoiy", label: "Navoiy viloyati" },
  { value: "karakalpakstan", label: "Qoraqalpog‘iston Respublikasi" },
  { value: "samarkand", label: "Samarqand viloyati" },
  { value: "sirdaryo", label: "Sirdaryo viloyati" },
  { value: "surkhandarya", label: "Surxondaryo viloyati" },
] as const;

const LABEL_BY_VALUE = new Map(UZ_REGIONS.map((region) => [region.value, region.label]));

/** The region's display name, or the raw value if it is not a known slug. */
export function uzRegionLabel(value: string): string {
  return LABEL_BY_VALUE.get(value) ?? value;
}

/** True when `value` is one of the known region slugs. */
export function isUzRegion(value: string): boolean {
  return LABEL_BY_VALUE.has(value);
}
