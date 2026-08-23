import { sellerApiRequest } from "./client";
import type { Paginated, ProductStock, ProductsQuery, SellerProduct } from "./types";

export function fetchProducts(query: ProductsQuery): Promise<Paginated<SellerProduct>> {
  return sellerApiRequest<Paginated<SellerProduct>>("/seller/products", { query });
}

export function fetchProduct(id: string): Promise<SellerProduct> {
  return sellerApiRequest<SellerProduct>(`/seller/products/${id}`);
}

export function fetchProductStock(id: string): Promise<ProductStock> {
  return sellerApiRequest<ProductStock>(`/seller/products/${id}/stock`);
}
