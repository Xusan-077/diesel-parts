import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { StockMovementType } from '../../../../generated/prisma/client';

/** Filters for one product's stock ledger. */
export class QueryProductMovementsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  type?: StockMovementType;
}
