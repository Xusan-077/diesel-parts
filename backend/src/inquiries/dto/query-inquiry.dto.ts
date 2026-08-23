import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { INQUIRY_COLUMNS, type InquiryColumn } from '../inquiry-board';

/**
 * `GET seller/inquiries` query — matches `InquiryListQuery` from the root
 * Next.js app's `lib/schemas.ts` (`inquiryListQuerySchema`). No `limit`:
 * the seller board's page size is fixed (`SELLER_PAGE_SIZE`), not
 * client-configurable.
 */
export class QueryInquiryDto {
  @IsOptional()
  @IsIn(INQUIRY_COLUMNS)
  column?: InquiryColumn;

  /** Directors only; a seller's list is scoped to them whatever they ask for. */
  @IsOptional()
  @IsString()
  sellerId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number = 1;
}
