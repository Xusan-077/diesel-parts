import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { InquiryStatus } from '../../../generated/prisma/client';

/**
 * `PATCH seller/inquiries/:id` body — matches `InquiryUpdateInput` from the
 * root Next.js app's `lib/schemas.ts` (`inquiryUpdateSchema`). "Band
 * qilingan" (claiming) is deliberately absent: that is `POST
 * seller/inquiries/:id/claim`, a separate endpoint — the column otherwise
 * falls out of the assignee (see `inquiry-board.ts`).
 *
 * Every field is optional, but the object must carry at least one — a PATCH
 * with none would be a no-op the caller didn't mean to send. That
 * "at-least-one" rule is enforced in `InquiriesService.updateInquiry`
 * rather than here: class-validator has no built-in "at least one of these
 * optional fields" check, and the alternative (a custom validator) is more
 * code than the one `if` in the service.
 */
export class UpdateInquiryDto {
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  /** ISO date or date-time; `null` clears the callback date. */
  @IsOptional()
  @IsISO8601({ strict: false })
  followUpAt?: string | null;
}
