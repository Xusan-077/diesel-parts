import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { AI_LOCALES } from '../../ai/translation.schema';
import type { AiLocale } from '../../ai/translation.schema';

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  slug: string;

  /** Name in `sourceLocale`. Spell-corrected and translated into the other
   * AI_LOCALES (+ oz via transliteration) on save — see CategoriesService.create. */
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsIn(AI_LOCALES)
  sourceLocale?: AiLocale;

  /** Locales already known (typically from the form's "AI bilan tekshirish"
   * step, possibly hand-edited afterwards) — never silently overwritten. */
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

  /** "Qayta tarjima" — re-translate specific locales even though a value for
   * them was already supplied above. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(AI_LOCALES, { each: true })
  forceLocales?: AiLocale[];

  @IsOptional()
  @IsString()
  parentId?: string;

  /** Part family this branch belongs to - "engine", "brakes", "filters". Defaults to "general". */
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsInt()
  order?: number;
}
