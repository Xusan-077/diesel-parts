import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { InquirySource } from '../../../generated/prisma/client';

/**
 * `POST /inquiries` body — the public-site inquiry form (product dialog,
 * quote request, contact form all funnel into this one shape). Matches
 * `CreateInquiryInput` from the root Next.js app's
 * `lib/api/inquiry-repository.ts`.
 *
 * Public and unauthenticated on purpose: this is a contact form, not an
 * identity claim. The phone submitted here is recorded as contact
 * information for a seller to call back — the same trust model as any
 * public "leave your number" form — so, unlike the Reviews module's
 * phone-gated endpoints, this route needs no `InternalServiceGuard` /
 * `@VerifiedPhone()`. Nothing here reads or mutates data that belongs to
 * whoever the phone number actually reaches.
 */
export class CreateInquiryDto {
  @IsString()
  @MinLength(1)
  customerName!: string;

  /**
   * Free text as typed by the visitor. Not validated as a phone number: the
   * product-dialog form has no phone field at all and sends `""` (see the
   * root app's `app/api/inquiry/route.ts`), and this endpoint just records
   * whatever contact detail the form collected.
   */
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsEnum(InquirySource)
  source!: InquirySource;

  @IsOptional()
  @IsString()
  productId?: string | null;

  @IsOptional()
  @IsString()
  productSku?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number | null;
}
