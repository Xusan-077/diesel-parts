import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AI_LOCALES } from '../../ai/translation.schema';
import type { AiLocale } from '../../ai/translation.schema';

export class BrandLocaleFieldsDto {
  @IsString()
  @MinLength(1)
  name: string;
}

export class CreateBrandDto {
  /** Name in `sourceLocale`. Spell-corrected and translated into the other
   * AI_LOCALES (+ oz via transliteration) on save — see BrandsService.create. */
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  slug: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsIn(AI_LOCALES)
  sourceLocale?: AiLocale;

  /** Locales already known (typically from the form's "AI bilan tekshirish"
   * step, possibly hand-edited afterwards) — never silently overwritten. */
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandLocaleFieldsDto)
  translationUz?: BrandLocaleFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandLocaleFieldsDto)
  translationRu?: BrandLocaleFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandLocaleFieldsDto)
  translationEn?: BrandLocaleFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandLocaleFieldsDto)
  translationZh?: BrandLocaleFieldsDto;

  /** "Qayta tarjima" — re-translate specific locales even though a value for
   * them was already supplied above. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(AI_LOCALES, { each: true })
  forceLocales?: AiLocale[];
}
