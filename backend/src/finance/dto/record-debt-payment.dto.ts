import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  Matches,
} from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';

/** The methods a staff member may pick when recording a payment by hand. */
export const MANUAL_PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.TRANSFER,
] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export class RecordDebtPaymentDto {
  /** > 0, at most 2 decimal places. Must not exceed the outstanding balance. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsIn([...MANUAL_PAYMENT_METHODS], {
    message: 'method must be CASH, CARD or TRANSFER',
  })
  method: ManualPaymentMethod;

  /** `YYYY-MM-DD`; defaults to now when omitted. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'paidAt must be YYYY-MM-DD' })
  paidAt?: string;
}
