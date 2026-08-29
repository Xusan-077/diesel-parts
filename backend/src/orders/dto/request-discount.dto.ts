import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class RequestDiscountDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  percent: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
