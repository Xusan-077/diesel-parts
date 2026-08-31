import type { Locale } from "@/lib/i18n/locales";
import type { HomeProductsResponse } from "@/lib/product-collections";
import type { Product } from "@/lib/types";
import { apiClient } from "./client";
import type { ProductPage, ProductQuery } from "./product-query";

export type ProductListParams = Partial<ProductQuery>;

/** Stable, serialisable key for React Query caching. */
export function productsQueryKey(params: ProductListParams) {
  return ["products", params] as const;
}

export function toSearchParams(params: ProductListParams): URLSearchParams {
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q);
  // One `brand` per ticked box. An empty list is "every brand", so unlike the
  // category scope below there is nothing to send for it.
  for (const id of params.brandIds ?? []) {
    search.append("brand", id);
  }
  if (params.priceMin != null) search.set("priceMin", String(params.priceMin));
  if (params.priceMax != null) search.set("priceMax", String(params.priceMax));
  if (params.categoryId && params.categoryId !== "all") {
    search.set("category", params.categoryId);
  }
  if (params.availability && params.availability !== "all") {
    search.set("availability", params.availability);
  }
  if (params.sort) search.set("sort", params.sort);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));
  if (params.lang) search.set("lang", params.lang);

  // An empty array is a real scope ("no products yet"), so it must still be
  // sent — hence appending an empty value rather than skipping the key.
  if (params.categoryIds) {
    if (params.categoryIds.length === 0) {
      search.append("categoryIds", "");
    } else {
      for (const id of params.categoryIds) {
        search.append("categoryIds", id);
      }
    }
  }

  return search;
}

export async function fetchProducts(params: ProductListParams): Promise<ProductPage<Product>> {
  const response = await apiClient.get<ProductPage<Product>>("/products", {
    params: toSearchParams(params),
  });
  return response.data;
}

export async function fetchProduct(slug: string): Promise<Product> {
  const response = await apiClient.get<Product>(`/products/${slug}`);
  return response.data;
}

/** Stable key for the one request the three home rows share. */
export function homeProductsQueryKey(params: HomeProductsParams) {
  return ["home-products", params.lang, params.limit] as const;
}

export interface HomeProductsParams {
  lang: Locale;
  limit: number;
}

/**
 * The home page's three collections. `lang` is in the query because the card
 * captions carry a category name, which is localised server-side — the same
 * reason `/api/products/by-ids` takes one.
 */
export async function fetchHomeProducts(
  params: HomeProductsParams,
): Promise<HomeProductsResponse> {
  const response = await apiClient.get<HomeProductsResponse>("/products/home", {
    params: { lang: params.lang, limit: params.limit },
  });
  return response.data;
}
