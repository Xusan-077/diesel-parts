import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCheckoutDto } from './create-checkout.dto';

const basePayload = {
  firstName: 'Aziz',
  lastName: 'Karimov',
  deliveryMethod: 'PICKUP',
  termsAccepted: true,
  paymentMethod: 'ONLINE',
};

describe('CreateCheckoutDto validation', () => {
  it('accepts a minimal pickup order', async () => {
    const dto = plainToInstance(CreateCheckoutDto, basePayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('requires city, district, and street once deliveryMethod is DELIVERY', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'DELIVERY',
    });
    const errors = await validate(dto);
    const fields = errors.map((error) => error.property).sort();
    expect(fields).toEqual(['city', 'district', 'street']);
  });

  it('passes once DELIVERY carries a full address', async () => {
    const dto = plainToInstance(CreateCheckoutDto, {
      ...basePayload,
      deliveryMethod: 'DELIVERY',
      city: 'Toshkent',
      district: 'Chilonzor',
      street: 'Bunyodkor 12',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
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
});
