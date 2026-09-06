import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidateIf,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidPhone } from '../../common/phone';

/** True exactly when the DTO under validation chose home delivery. */
function isDelivery(dto: CreateCheckoutDto): boolean {
  return dto.deliveryMethod === 'DELIVERY';
}

/** Accepts any written form of a 9-digit Uzbek number — the service
 *  canonicalises it before storing. Shares `common/phone.ts` with the OTP flow. */
function IsUzPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUzPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidPhone(value),
        defaultMessage: () => 'phone must be a valid Uzbek number',
      },
    });
  };
}

/** Cash needs someone at the counter to take it, so it is pickup-only. The
 *  storefront hides the option once delivery is chosen; this is the server
 *  guard that answers a request that reached the endpoint anyway. */
function IsCashPickupOnly(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCashPickupOnly',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const dto = args.object as CreateCheckoutDto;
          return !(value === 'CASH' && dto.deliveryMethod === 'DELIVERY');
        },
        defaultMessage: () =>
          'CASH payment is only available for pickup orders',
      },
    });
  };
}

export class CreateCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName: string;

  /** The contact number for this order. Required — a courier or a manager needs
   *  a number to call, and it may not be the account's verified one. */
  @IsString()
  @IsUzPhone()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  /** B2B-only, both optional — a self-checkout order is a retail sale by default. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxId?: string;

  @IsIn(['PICKUP', 'DELIVERY'])
  deliveryMethod: 'PICKUP' | 'DELIVERY';

  /**
   * "Viloyat / shahar" — the region-level unit ("Toshkent shahri",
   * "Samarqand viloyati"). Required for delivery; the flat `city` column below
   * stays optional for legacy and POS/CRM orders.
   */
  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  street?: string;

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  house?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  apartment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  landmark?: string;

  /** Entrance/floor/access guidance — distinct from `notes` below. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryNotes?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Must be literally `true` — `IsIn([true])` is how class-validator spells
   *  "this exact value or fail" (see the DTO spec's `termsAccepted: false` case). */
  @IsIn([true])
  termsAccepted: boolean;

  /**
   * ONLINE pays through Payme; CASH is settled on pickup; SELLER_AGREEMENT
   * creates the order and hands it to a manager. BANK_TRANSFER / QUOTE and
   * anything else fail with a clear 400 rather than silently creating an
   * unpayable order. CASH + DELIVERY is rejected by `IsCashPickupOnly`.
   */
  @IsIn(['ONLINE', 'CASH', 'SELLER_AGREEMENT'])
  @IsCashPickupOnly()
  paymentMethod: 'ONLINE' | 'CASH' | 'SELLER_AGREEMENT';

  /**
   * The storefront's own origin (`NEXT_PUBLIC_SITE_URL`), sent by the Next.js
   * proxy route rather than typed by hand — see checkout.service.ts's
   * `returnUrl` construction. `require_tld: false` so `http://localhost:3000`
   * validates in local dev.
   */
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnBaseUrl?: string;
}
