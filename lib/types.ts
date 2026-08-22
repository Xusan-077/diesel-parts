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
  imageLabels: string[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  body: LocalizedText;
  publishedAt: string;
}
