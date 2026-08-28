import { Prisma, PaymentStatus } from '../../generated/prisma/client';

/**
 * UZS (Decimal, as Prisma stores it) to tiyin (the integer Payme's whole
 * protocol is denominated in) — the one place this conversion happens.
 */
export function toTiyin(amount: Prisma.Decimal | number): number {
  const som = amount instanceof Prisma.Decimal ? amount.toNumber() : amount;
  return Math.round(som * 100);
}

export interface PaymeCheckoutParams {
  merchantId: string;
  orderId: string;
  amountTiyin: number;
  /** Where Payme sends the shopper back after paying. */
  returnUrl?: string;
}

/**
 * https://checkout.paycom.uz/{base64(m=...;ac.order_id=...;a=...[;c=...])} —
 * confirmed against developer.help.paycom.uz's own GET-method example.
 */
export function buildPaymeCheckoutUrl(params: PaymeCheckoutParams): string {
  const parts = [
    `m=${params.merchantId}`,
    `ac.order_id=${params.orderId}`,
    `a=${params.amountTiyin}`,
  ];
  if (params.returnUrl) {
    parts.push(`c=${params.returnUrl}`);
  }
  const encoded = Buffer.from(parts.join(';'), 'utf-8').toString('base64');
  return `https://checkout.paycom.uz/${encoded}`;
}

/**
 * Payme's transaction state as an integer (1 created, 2 performed, -1
 * cancelled-before-perform, -2 cancelled-after-perform/refunded), mapped
 * from Prisma's own PaymentStatus so no second status vocabulary exists.
 */
export function paymeState(status: PaymentStatus): 1 | 2 | -1 | -2 {
  switch (status) {
    case PaymentStatus.PENDING:
      return 1;
    case PaymentStatus.COMPLETED:
      return 2;
    case PaymentStatus.FAILED:
      return -1;
    case PaymentStatus.REFUNDED:
      return -2;
  }
}
