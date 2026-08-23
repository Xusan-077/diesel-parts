import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { StockStatus } from '../../products/stock-status';

export class QueryInventoryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(StockStatus)
  status?: StockStatus;
}
