import { IsBoolean } from 'class-validator';

/** `PATCH /reviews/:id/approval` — a director taking a review down, or putting one back. */
export class ModerateReviewDto {
  @IsBoolean()
  isApproved!: boolean;
}
