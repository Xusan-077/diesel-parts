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
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
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
  oemNumber: string;
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
