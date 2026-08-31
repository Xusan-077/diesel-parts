import { Prisma } from '../../generated/prisma/client';
import { buildPaymeCheckoutUrl, toTiyin } from './payme-money';

describe('toTiyin', () => {
  it('converts a UZS Decimal to tiyin', () => {
    expect(toTiyin(new Prisma.Decimal('500000'))).toBe(50000000);
  });

  it('converts a UZS Decimal with fractional som', () => {
    expect(toTiyin(new Prisma.Decimal('1234.56'))).toBe(123456);
  });

  it('accepts a plain number too', () => {
    expect(toTiyin(5)).toBe(500);
  });

  it('rounds rather than truncates', () => {
    expect(toTiyin(new Prisma.Decimal('10.005'))).toBe(1001);
  });
});

describe('buildPaymeCheckoutUrl', () => {
  it("matches the exact example from Payme's own documentation", () => {
    // developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/ —
    // m=587f72c72cac0d162c722ae2;ac.order_id=197;a=500 encodes to exactly this.
    const url = buildPaymeCheckoutUrl({
      merchantId: '587f72c72cac0d162c722ae2',
      orderId: '197',
      amountTiyin: 500,
    });
    expect(url).toBe(
      'https://checkout.paycom.uz/bT01ODdmNzJjNzJjYWMwZDE2MmM3MjJhZTI7YWMub3JkZXJfaWQ9MTk3O2E9NTAw',
    );
  });

  it('appends a return-url callback when given one', () => {
    const url = buildPaymeCheckoutUrl({
      merchantId: 'm1',
      orderId: 'o1',
      amountTiyin: 100,
      returnUrl: 'https://example.com/done',
    });
    const decoded = Buffer.from(url.split('/').pop()!, 'base64').toString(
      'utf-8',
    );
    expect(decoded).toBe(
      'm=m1;ac.order_id=o1;a=100;c=https://example.com/done',
    );
  });
});
