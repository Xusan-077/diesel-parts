import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CloseShiftDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingBalanceActual: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
