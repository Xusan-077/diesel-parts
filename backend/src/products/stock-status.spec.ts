import { deriveStockStatus, StockStatus } from './stock-status';

describe('deriveStockStatus', () => {
  it('is OUT_OF_STOCK when available is zero or negative', () => {
    expect(deriveStockStatus(0, 5)).toBe(StockStatus.OUT_OF_STOCK);
    expect(deriveStockStatus(-2, 5)).toBe(StockStatus.OUT_OF_STOCK);
  });

  it('is LOW_STOCK when available is positive but at or below minStock', () => {
    expect(deriveStockStatus(1, 5)).toBe(StockStatus.LOW_STOCK);
    expect(deriveStockStatus(5, 5)).toBe(StockStatus.LOW_STOCK);
  });

  it('is IN_STOCK when available exceeds minStock', () => {
    expect(deriveStockStatus(6, 5)).toBe(StockStatus.IN_STOCK);
  });
});
