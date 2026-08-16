import { formatPrice, sumPrices } from "@/lib/format-price";
import type { Locale } from "@/lib/i18n/locales";
import type { Product } from "@/lib/types";

export interface CartLine {
  product: Product;
  quantity: number;
}

/** Structured form of a cart line, sent alongside the quote request. */
export interface QuoteCartItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number | null;
}

export function toQuoteCartItems(lines: readonly CartLine[], lang: Locale): QuoteCartItem[] {
  return lines.map(({ product, quantity }) => ({
    productId: product.id,
    sku: product.sku,
    name: product.name[lang],
    quantity,
    price: product.price,
  }));
}

/**
 * Renders the cart as plain text for the quote form's "products" field, so the
 * customer can see and edit exactly what the manager will receive.
 *
 * Example line: `CAT 3126 Fuel Injector (DP-INJ-3126) — 2 × 3 450 000 so'm`
 */
export function formatCartForQuote(
  lines: readonly CartLine[],
  lang: Locale,
  labels: { onRequest: string; total: string }
): string {
  if (lines.length === 0) {
    return "";
  }

  const rows = lines.map(({ product, quantity }) => {
    const unit = formatPrice(product.price, lang) ?? labels.onRequest;
    return `${product.name[lang]} (${product.sku}) — ${quantity} × ${unit}`;
  });

  const { total } = sumPrices(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );

  if (total > 0) {
    rows.push(`${labels.total}: ${formatPrice(total, lang)}`);
  }

  return rows.join("\n");
}

/** Total units, used to prefill the quantity field. */
export function totalQuantity(lines: readonly CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
