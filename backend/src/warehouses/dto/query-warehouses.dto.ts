import { IsEnum, IsOptional } from 'class-validator';
import { WarehouseStatus } from '../../../generated/prisma/client';

export class QueryWarehousesDto {
  @IsOptional()
  @IsEnum(WarehouseStatus)
  status?: WarehouseStatus;
}
