import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One entry of the reference list the Next.js caller already has loaded. */
export class ReferenceOptionDto {
  @IsString()
  id: string;

  @IsString()
  label: string;
}

/**
 * The category/brand ids Gemini may pick from come from the caller, not from
 * this service's own lookup — the backend and the root Next.js app (which is
 * what actually creates the product) run against two separate Postgres
 * databases with two separate id spaces. Matching against a list the caller
 * already has is the only way the returned `categoryId`/`brandId` are valid
 * where they will actually be used.
 */
export class AiFillDto {
  @IsString()
  @MinLength(1)
  oemNumber: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReferenceOptionDto)
  categories: ReferenceOptionDto[];

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ReferenceOptionDto)
  brands: ReferenceOptionDto[];
}
