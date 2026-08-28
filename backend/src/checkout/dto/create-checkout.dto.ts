import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCheckoutDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /**
   * Only ONLINE is handled today. Accepting the field (rather than assuming
   * it) means BANK_TRANSFER/QUOTE reaching this endpoint fail loudly with a
   * clear 400 instead of silently creating an order with no way to pay it —
   * those two paths are their own future plan.
   */
  @IsIn(['ONLINE'])
  paymentMethod: 'ONLINE';
}
