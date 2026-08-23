import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Reviews per request. Ported from the root app's `lib/reviews.ts`
 * (`REVIEWS_PAGE_SIZE`): a log is read a screen at a time, not all at once.
 */
export const REVIEWS_PAGE_SIZE = 5;

/**
 * Reviews per page in the moderation queue (`REVIEWS_MODERATION_PAGE_SIZE`).
 *
 * Four times the public page: a visitor reads reviews, a director scans them
 * looking for the one that has to come down, and that is a job twenty rows
 * at a time rather than five.
 */
export const REVIEWS_MODERATION_PAGE_SIZE = 20;

/**
 * `GET /reviews` — one page of a product's *visible* reviews.
 *
 * `authorPhone` is the caller's own phone when the Next.js layer has a
 * session for it (never a header/token — see reviews.service.ts). It is used
 * only to mark the caller's own row `isMine: true`; it is never itself
 * returned and never widens which rows are visible.
 */
export class QueryReviewDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = REVIEWS_PAGE_SIZE;

  @IsOptional()
  @IsString()
  authorPhone?: string;
}

/**
 * `GET /reviews/mine` — this person's review of this part, for seeding the
 * form. `authorPhone` is not a field here: it is sourced from
 * `@VerifiedPhone()` (`InternalServiceGuard`), not the query string — see
 * `backend/src/common/guards/internal-service.guard.ts`.
 */
export class OwnReviewQueryDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

/**
 * `GET /reviews/purchase-check` — whether this phone has a completed order
 * for this product. `phone` is not a field here: it is sourced from
 * `@VerifiedPhone()` (`InternalServiceGuard`), not the query string — see
 * `backend/src/common/guards/internal-service.guard.ts`. An invalid phone is
 * not a validation error: the service treats it the same as "no purchase
 * found" (see `ReviewsService.hasPurchased`).
 */
export class PurchaseCheckQueryDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}

/**
 * `GET /reviews/admin` — the moderation queue. `productId` narrows it to one
 * product; omitted, it is every review, exactly as the source `listAllReviews`.
 */
export class QueryAdminReviewDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = REVIEWS_MODERATION_PAGE_SIZE;

  @IsOptional()
  @IsString()
  productId?: string;
}
