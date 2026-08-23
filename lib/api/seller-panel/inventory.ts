import { sellerApiRequest } from "./client";
import type { InventoryQuery, InventoryRow, MovementsQuery, Paginated, StockMovement } from "./types";

export function fetchInventory(query: InventoryQuery): Promise<Paginated<InventoryRow>> {
  return sellerApiRequest<Paginated<InventoryRow>>("/seller/inventory", { query });
}

export function fetchLowStock(query: InventoryQuery): Promise<Paginated<InventoryRow>> {
  return sellerApiRequest<Paginated<InventoryRow>>("/seller/inventory/low-stock", { query });
}

export function fetchStockMovements(query: MovementsQuery): Promise<Paginated<StockMovement>> {
  return sellerApiRequest<Paginated<StockMovement>>("/seller/inventory/movements", { query });
}
