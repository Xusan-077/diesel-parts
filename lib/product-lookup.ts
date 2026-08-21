import type { Product } from "@/lib/types";

/** A product plus the display names of its brand and category in one locale. */
export interface ResolvedProduct {
  product: Product;
  brandName: string;
  categoryName: string;
}
