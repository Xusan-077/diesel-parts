import { IsString, MinLength } from 'class-validator';

/** `GET /catalog/products/stats?ids=a,b,c` — a comma-separated id list. */
export class QueryProductStatsDto {
  @IsString()
  @MinLength(1)
  ids: string;
}
