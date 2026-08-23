export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export type StockStatus = "available" | "limited" | "out_of_stock";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  /**
   * Mark shown beside the brand in the catalog filter. Optional because most
   * rows have none yet; the filter draws a monogram tile in its place rather
   * than a gap, so the list keeps one rhythm either way.
   */
  logoUrl?: string | null;
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
  /**
   * Parent column in the catalog tree, or null/absent for a root. The filter
   * sidebar nests its rows from this; the seed data omits it, which reads the
   * same as a flat list of roots.
   */
  parentId?: string | null;
}

export interface ProductSpec {
  label: LocalizedText;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  sku: string;
  /**
   * OEM/aftermarket cross-references. A part commonly carries several; the
   * first is the primary number shown in compact contexts.
   */
  oemNumbers: string[];
  /**
   * Price in UZS, or `null` when it has not been set yet — those products show
   * a "contact us" action instead of an add-to-cart button.
   */
  price: number | null;
  categoryId: string;
  brandId: string;
  description: LocalizedText;
  compatibleModels: string[];
  stockStatus: StockStatus;
  specs: ProductSpec[];
  /**
   * A photograph, set through the admin panel's upload endpoints. `null` on
   * every row nobody has photographed yet — the storefront falls back to a
   * placeholder icon rather than showing a broken image. Every product has
   * exactly one; a `ProductImage` table for a real multi-photo gallery is a
   * later feature, not implied by this field.
   */
  imageUrl: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  publishedAt: string;
}
