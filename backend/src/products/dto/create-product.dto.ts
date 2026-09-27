import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { AI_LOCALES } from '../../ai/translation.schema';
import type { AiLocale } from '../../ai/translation.schema';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  @MinLength(1)
  slug: string;

  /** Which locale field below is the "source" text — spell-corrected and
   * translated into the rest (+ oz via transliteration) on save, via
   * ProductsService.buildLocaleData. Omitted entirely (the CSV import path,
   * see ProductsService.importCsv) means "no AI, take nameUz/nameRu/nameEn
   * literally" — the pre-AI behavior, unchanged for that path. */
  @IsOptional()
  @IsIn(AI_LOCALES)
  sourceLocale?: AiLocale;

  /** Required in practice: either the sourceLocale's own field (checked at
   * runtime — which one is required depends on `sourceLocale`), or, for the
   * CSV import path, all three literally. Not enforced here with @MinLength
   * because that requirement is conditional. */
  @IsOptional()
  @IsString()
  nameUz?: string;

  @IsOptional()
  @IsString()
  nameRu?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  nameZh?: string;

  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(AI_LOCALES, { each: true })
  forceLocales?: AiLocale[];

  @IsString()
  categoryId: string;

  @IsString()
  brandId: string;

  @IsOptional()
  @IsString()
  descriptionUz?: string;

  @IsOptional()
  @IsString()
  descriptionRu?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsString()
  descriptionZh?: string;

  /** Nullable in the schema (price-on-request); omit to leave unset. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number | null;

  /** Nullable in the schema; not every migrated product has one on record. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  /** Scanned barcode (EAN/UPC or in-house). Unique — a duplicate is a 409. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  barcode?: string;

  /** Unit of issue — "dona", "litr", "komplekt". Free text. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

  /** Target on-hand for replenishment suggestions; distinct from minStock. */
  @IsOptional()
  @IsInt()
  @Min(0)
  recommendedStock?: number;

  /**
   * Not a Product column (stock is Inventory-derived) — when given, the
   * service upserts it onto the catalog warehouse's Inventory row, the same
   * one CSV import writes to (see ProductsService.setCatalogStock).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  specs?: unknown;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  oemNumbers?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compatibleModels?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
