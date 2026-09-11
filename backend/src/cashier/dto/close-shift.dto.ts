import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  closingBalanceActual: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
