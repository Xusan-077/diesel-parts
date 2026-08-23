import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Bounds ported from the root app's `lib/reviews.ts` (`validateReviewDraft`),
 * so a submission the browser's own check accepted cannot be rejected here.
 */
export const REVIEW_BODY_MIN = 10;
export const REVIEW_BODY_MAX = 1000;
export const REVIEW_AUTHOR_MAX = 60;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Writes this person's review of this part — the body PUT /reviews accepts.
 *
 * `authorPhone` is deliberately not a field here: it is not a value the
 * caller gets to assert. The controller sources it from
 * `@VerifiedPhone()`, which `InternalServiceGuard` set after verifying an
 * HMAC signature proving the call came from Next.js's own server-side code
 * (which itself checked the OTP session) — see
 * `backend/src/common/guards/internal-service.guard.ts`.
 */
export class UpsertReviewDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @Transform(trim)
  @MinLength(REVIEW_BODY_MIN)
  @MaxLength(REVIEW_BODY_MAX)
  body!: string;

  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(REVIEW_AUTHOR_MAX)
  authorName!: string;
}
