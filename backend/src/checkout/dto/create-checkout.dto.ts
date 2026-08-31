import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** True exactly when the DTO under validation chose home delivery. */
function isDelivery(dto: CreateCheckoutDto): boolean {
  return dto.deliveryMethod === 'DELIVERY';
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

  @ValidateIf(isDelivery)
  @IsString()
  @MinLength(1)
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

  /** Entrance/floor/landmark guidance — distinct from `notes` below. */
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
   * Only ONLINE is handled today. Accepting the field (rather than assuming
   * it) means BANK_TRANSFER/QUOTE reaching this endpoint fail loudly with a
   * clear 400 instead of silently creating an order with no way to pay it —
   * those two paths are their own future plan.
   */
  @IsIn(['ONLINE'])
  paymentMethod: 'ONLINE';

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
