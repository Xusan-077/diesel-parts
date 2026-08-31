const moneyFormatter = new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("uz-UZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Decimal columns arrive as strings over JSON (Prisma Decimal). */
export function formatMoney(value: string | number): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  return `${moneyFormatter.format(Number.isFinite(numeric) ? numeric : 0)} so'm`;
}

export function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
