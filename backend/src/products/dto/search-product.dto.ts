import { IsString, MaxLength, MinLength } from 'class-validator';

/** Mirrors root's `PRODUCT_SEARCH_MIN_LENGTH` — below this a search matches half the catalog. */
export const PRODUCT_SEARCH_MIN_LENGTH = 2;

export class SearchProductDto {
  @IsString()
  @MinLength(PRODUCT_SEARCH_MIN_LENGTH)
  @MaxLength(120)
  q: string;
}
