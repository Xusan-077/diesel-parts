export interface CartLine {
  productId: string;
  sku: string;
  nameEn: string;
  /** Null for a product with no catalog price — the sale needs a director-set price before it can be added. */
  unitPrice: number | null;
  availableQuantity: number;
  qty: number;
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
}
