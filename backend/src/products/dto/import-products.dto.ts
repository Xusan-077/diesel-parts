import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Request body for `POST products/import` — the raw CSV text of the upload. */
export class ImportProductsDto {
  @IsString()
  @MinLength(1)
  csv: string;
}

/**
 * One catalog row as it arrives from the CSV. Field rules mirror the root app's
 * `productWriteSchema` so a file the old director panel accepted still imports.
 * `stock` and `isActive` are written outside the product row (stock lands on an
 * Inventory record; see ProductsService.importCsv).
 */
export class ImportProductRowDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  sku: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug: noto‘g‘ri format' })
  slug: string;

  @IsArray()
  @IsString({ each: true })
  oemNumbers: string[];

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
  descriptionUz: string;

  @IsString()
  descriptionRu: string;

  @IsString()
  descriptionEn: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price: number | null;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  minStock: number;

  @IsString()
  @MinLength(1)
  categoryId: string;

  @IsString()
  @MinLength(1)
  brandId: string;

  @IsArray()
  @IsString({ each: true })
  compatibleModels: string[];

  @IsBoolean()
  isActive: boolean;
}
