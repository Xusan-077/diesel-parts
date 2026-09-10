/**
 * Builds a finance-tab URL from a filter record, dropping empty values and the
 * `page=1` default. Shared by the three tables so "which params live in the
 * URL" is stated once.
 */
export function financeListUrl(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === null) continue;
    if (key === "page" && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
