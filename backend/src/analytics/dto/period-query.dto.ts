import { IsISO8601, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The director analytics screen's window, computed root-side by root's own
 * `lib/analytics/period.ts` (pure, date-arithmetic only) and sent through
 * as-is — this service does no period math of its own, only queries the
 * boundaries it's given. `previousFrom`/`previousTo` and `days` are only
 * required by the comparison-shaped endpoints (sales-summary, revenue-series,
 * sales-series); the single-window endpoints (seller-performance,
 * order-status-breakdown, product-movement, seller-scorecards,
 * customer-analytics) only read `from`/`to`.
 */
export class PeriodQueryDto {
  @IsISO8601()
  from: string;

  @IsISO8601()
  to: string;

  @IsOptional()
  @IsISO8601()
  previousFrom?: string;

  @IsOptional()
  @IsISO8601()
  previousTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days?: number;
}

export class LimitQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PeriodLimitQueryDto extends PeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
