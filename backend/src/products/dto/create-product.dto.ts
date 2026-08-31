import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  sku: string;

  @IsString()
  @MinLength(1)
  slug: string;

  @IsString()
  @MinLength(1)
  nameUz: string;

  @IsString()
  @MinLength(1)
  nameRu: string;

  @IsString()
  @MinLength(1)
  nameEn: string;

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

  @IsOptional()
  @IsInt()
  @Min(0)
  minStock?: number;

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
