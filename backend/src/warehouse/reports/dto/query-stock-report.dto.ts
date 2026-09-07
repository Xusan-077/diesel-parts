import { IsOptional, IsString } from 'class-validator';

export class QueryStockReportDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
