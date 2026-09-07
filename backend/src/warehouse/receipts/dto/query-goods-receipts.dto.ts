import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { GoodsReceiptStatus } from '../../../../generated/prisma/client';

export class QueryGoodsReceiptsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsEnum(GoodsReceiptStatus)
  status?: GoodsReceiptStatus;

  /** Matches receiptNumber or supplierName, case-insensitive. */
  @IsOptional()
  @IsString()
  q?: string;
}
