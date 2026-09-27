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
import { AI_LOCALES } from '../translation.schema';
import type { AiLocale } from '../translation.schema';

export class SourceFieldsDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

/** Locales the caller already has (e.g. hand-edited in another tab, or from
 * a previous translate call) — the AI service never overwrites these unless
 * `force` names them in `forceLocales`. */
export class ExistingLocalesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFieldsDto)
  uz?: SourceFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFieldsDto)
  ru?: SourceFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFieldsDto)
  en?: SourceFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SourceFieldsDto)
  zh?: SourceFieldsDto;
}

export class TranslateRequestDto {
  @IsIn(AI_LOCALES)
  sourceLocale: AiLocale;

  @ValidateNested()
  @Type(() => SourceFieldsDto)
  fields: SourceFieldsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ExistingLocalesDto)
  existing?: ExistingLocalesDto;

  /** "Qayta tarjima" — re-translate specific locales even though `existing`
   * already has them. Locales not in `forceLocales` still only fill gaps. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(AI_LOCALES, { each: true })
  forceLocales?: AiLocale[];
}
