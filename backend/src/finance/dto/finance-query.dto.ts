import { IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  ExpenseCategory,
  OrderPaymentStatus,
  PaymentMethod,
} from '../../../generated/prisma/client';

/** `YYYY-MM-DD` — a calendar day, widened to a Tashkent (UTC+5) range server-side. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export class FinanceSummaryQueryDto {
  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;
}

export class QueryPaymentsDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  /** Matches order number or customer name, case-insensitive. */
  @IsOptional()
  @IsString()
  q?: string;
}

export class QueryExpensesDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateFrom must be YYYY-MM-DD' })
  dateFrom?: string;

  @IsOptional()
  @Matches(ISO_DAY, { message: 'dateTo must be YYYY-MM-DD' })
  dateTo?: string;

  /** Matches the expense title, case-insensitive. */
  @IsOptional()
  @IsString()
  q?: string;
}

/** `PAID` is not debt, so only the two open states are accepted. */
export type DebtFilterStatus = Extract<
  OrderPaymentStatus,
  'UNPAID' | 'PARTIAL'
>;

export const DEBT_FILTER_STATUSES: DebtFilterStatus[] = [
  OrderPaymentStatus.UNPAID,
  OrderPaymentStatus.PARTIAL,
];

export class QueryDebtsDto extends PaginationDto {
  @IsOptional()
  @IsIn(DEBT_FILTER_STATUSES, { message: 'status must be UNPAID or PARTIAL' })
  status?: DebtFilterStatus;

  /** Matches order number or customer name, case-insensitive. */
  @IsOptional()
  @IsString()
  q?: string;
}
