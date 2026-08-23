export enum StockStatus {
  IN_STOCK = 'IN_STOCK',
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

/** available = quantity - reservedQuantity, computed here — never stored. */
export function deriveStockStatus(
  available: number,
  minStock: number,
): StockStatus {
  if (available <= 0) return StockStatus.OUT_OF_STOCK;
  if (available <= minStock) return StockStatus.LOW_STOCK;
  return StockStatus.IN_STOCK;
}
