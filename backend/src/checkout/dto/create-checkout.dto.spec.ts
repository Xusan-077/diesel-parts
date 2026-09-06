import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckoutDto } from './create-checkout.dto';

const basePayload = {
  firstName: 'Aziz',
  lastName: 'Karimov',
  phone: '998901234567',
  deliveryMethod: 'PICKUP',
  termsAccepted: true,
  paymentMethod: 'ONLINE',
};

const fullDeliveryAddress = {
  deliveryMethod: 'DELIVERY',
  region: 'Toshkent shahri',
  district: 'Chilonzor',
  street: 'Bunyodkor',
  house: '12',
};

describe('CreateCheckoutDto validation', () => {
  it('accepts a minimal pickup order', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires region, district, street, and house once deliveryMethod is DELIVERY', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'DELIVERY',
    });
    const errors = await validate(dto);
    const fields = errors.map((error) => error.property).sort();
    expect(fields).toEqual(['district', 'house', 'region', 'street']);
  });

  it('passes once DELIVERY carries a full address', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      ...fullDeliveryAddress,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('does not require the flat city column for a delivery order', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      ...fullDeliveryAddress,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'city')).toBe(false);
  });

  it('does not require an address for PICKUP even if deliveryMethod flips back', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'PICKUP',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects termsAccepted: false', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      termsAccepted: false,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'termsAccepted')).toBe(
      true,
    );
  });

  it('rejects a malformed email when one is provided', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      email: 'not-an-email',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(true);
  });

  it('accepts an order with no email at all', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'email')).toBe(false);
  });

  it('rejects an empty firstName', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      firstName: '',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'firstName')).toBe(true);
  });

  it('requires a contact phone', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      phone: undefined,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'phone')).toBe(true);
  });

  it('rejects a phone that is not a full Uzbek number', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      phone: '90 12',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'phone')).toBe(true);
  });

  it('accepts any written form of a valid phone', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      phone: '+998 90 123-45-67',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'phone')).toBe(false);
  });

  it('accepts CASH and SELLER_AGREEMENT for a pickup order', async () => {
    for (const paymentMethod of ['CASH', 'SELLER_AGREEMENT']) {
      const dto = plainToInstance(CreateCheckoutDto, {
        ...basePayload,
        paymentMethod,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects CASH for a delivery order but allows SELLER_AGREEMENT', async () => {
    const cash = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      ...fullDeliveryAddress,
      paymentMethod: 'CASH',
    });
    expect(
      (await validate(cash)).some(
        (error) => error.property === 'paymentMethod',
      ),
    ).toBe(true);

    const agreement = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      ...fullDeliveryAddress,
      paymentMethod: 'SELLER_AGREEMENT',
    });
    expect(await validate(agreement)).toHaveLength(0);
  });

  it('rejects an unknown payment method', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      paymentMethod: 'BANK_TRANSFER',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'paymentMethod')).toBe(
      true,
    );
  });
});
