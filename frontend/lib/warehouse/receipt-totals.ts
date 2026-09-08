/**
 * The goods-receipt arithmetic, in one place so the form's live preview and any
 * check against the saved figures agree.
 *
 * Mirrors `backend/`'s `GoodsReceiptsService.totals`: the line total is
 * `quantity × unitCost`, the subtotal is their sum, and the grand total is
 * `subtotal − discount + tax`. Money is rounded to whole so'm for display only
 * — the backend keeps two decimals.
 */

export interface ReceiptLineInput {
  quantity: number;
  unitCost: number;
}

export function lineTotal(line: ReceiptLineInput): number {
  const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
  const unitCost = Number.isFinite(line.unitCost) ? line.unitCost : 0;
  return quantity * unitCost;
}

export function computeReceiptTotals(
  lines: readonly ReceiptLineInput[],
  discount: number,
  tax: number,
): { subtotal: number; total: number } {
  const subtotal = lines.reduce((sum, line) => sum + lineTotal(line), 0);
  const safeDiscount = Number.isFinite(discount) && discount > 0 ? discount : 0;
  const safeTax = Number.isFinite(tax) && tax > 0 ? tax : 0;
  return { subtotal, total: subtotal - safeDiscount + safeTax };
}
