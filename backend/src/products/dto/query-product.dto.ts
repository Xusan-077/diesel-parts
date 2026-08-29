import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { StockStatus } from '../stock-status';

export type ProductSort = 'newest' | 'id' | 'stock';

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
   * `newest` (default) is the existing `createdAt desc` order. `id` gives the
   * storefront's home rows a visually different order from "newest" without
   * a real popularity signal to sort by. `stock` is ascending by computed
   * available quantity — the admin product list and the stock-overview page
   * both want the shortest stock first.
   */
  @IsOptional()
  @IsEnum(['newest', 'id', 'stock'])
  sort?: ProductSort;
}
