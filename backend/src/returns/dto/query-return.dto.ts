import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ReturnStatus } from '../../../generated/prisma/client';

export class QueryReturnDto extends PaginationDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  /** Matches returnNumber, the sale's orderNumber, or the customer's name — whatever the seller typed into the search box. */
  @IsOptional()
  @IsString()
  search?: string;
}
