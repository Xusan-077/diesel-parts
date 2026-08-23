import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** `PATCH /discount-requests/:id/decision` body — a director approving or rejecting one request. */
export class DecideDiscountDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
