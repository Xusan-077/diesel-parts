import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { StockStatus } from '../stock-status';

export type ProductSort = 'newest' | 'id' | 'stock' | 'name-asc' | 'name-desc';
export type NameLocale = 'uz' | 'ru' | 'en';

export class QueryProductDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsEnum(StockStatus)
  stockStatus?: StockStatus;

  /** Comma-separated id list — a batch lookup (cart/wishlist/compare), not a filter a person types. */
  @IsOptional()
  @IsString()
  ids?: string;

  /**
   * Comma-separated brand id list from the storefront's multi-select filter.
   * Wins over `brandId` when present — `''` is a real, deliberate scope that
   * matches nothing (every box unticked), not an absent filter.
   */
  @IsOptional()
  @IsString()
  brandIds?: string;

  /** Same shape and precedence as `brandIds`, for the catalog menu's category scope. */
  @IsOptional()
  @IsString()
  categoryIds?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  /**
   * Narrows `search` to one locale's name column, and picks the column for
   * `sort=name-asc|name-desc`. Omitted, `search` matches every locale's name
   * column at once (the admin/seller lookup's existing behavior, which must
   * not change for those callers) and a name sort is unavailable.
   */
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  lang?: NameLocale;

  /**
   * `newest` (default) is the existing `createdAt desc` order. `id` gives the
   * storefront's home rows a visually different order from "newest" without
   * a real popularity signal to sort by. `stock` is ascending by computed
   * available quantity — the admin product list and the stock-overview page
   * both want the shortest stock first. `name-asc`/`name-desc` need `lang`.
   */
  @IsOptional()
  @IsEnum(['newest', 'id', 'stock', 'name-asc', 'name-desc'])
  sort?: ProductSort;
}
