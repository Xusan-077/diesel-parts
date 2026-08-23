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
 * `authorPhone` is a plain field here rather than derived from a session: the
 * backend has no concept of a customer session, so the Next.js layer is the
 * one that reads the OTP-verified phone out of its cookie and passes it
 * along. It must never be trusted as *who may write* without that upstream
 * check — this DTO only shapes the request, it does not authorize it.
 */
export class UpsertReviewDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  authorPhone!: string;

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
