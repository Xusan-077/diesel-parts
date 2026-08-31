import { sellerApiRequest } from "./client";
import type { Brand, Category, Warehouse } from "./types";

/** GET /categories, /brands and /warehouses are @Roles(...ALL_ROLES) on the backend — open to every authenticated role, seller included. Used only to populate filter dropdowns (products, inventory). */
export function fetchCategories(): Promise<Category[]> {
  return sellerApiRequest<Category[]>("/categories");
}

export function fetchBrands(): Promise<Brand[]> {
  return sellerApiRequest<Brand[]>("/brands");
}

export function fetchWarehouses(): Promise<Warehouse[]> {
  return sellerApiRequest<Warehouse[]>("/warehouses");
}
