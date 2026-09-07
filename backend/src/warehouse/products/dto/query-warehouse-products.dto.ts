import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { StockStatus } from '../../../products/stock-status';

/**
 * The warehouse product list's filters. `q` searches name / sku / oem /
 * barcode; `status` is the derived stock status; `warehouseId` scopes the
 * returned stock figures to one warehouse (omitted → totals across all).
 */
export class QueryWarehouseProductsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  brandId?: string;

  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus;
}
