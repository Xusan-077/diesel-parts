import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { UpsertReviewDto } from './dto/upsert-review.dto';
import {
  OwnReviewQueryDto,
  PurchaseCheckQueryDto,
  QueryAdminReviewDto,
  QueryReviewDto,
} from './dto/query-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { VerifiedPhone } from '../common/decorators/verified-phone.decorator';

/**
 * Guards are applied per-route rather than at the controller: most of this
 * surface is the public product page (no session, no staff account — the
 * OTP-signed-in visitor's identity is just a phone the Next.js layer passes
 * along), and only the moderation endpoints are staff-only. The three routes
 * that read or write under a specific phone's identity (as opposed to just
 * taking one to mark "isMine" on a public list) additionally require
 * `InternalServiceGuard`, which proves the call came from Next.js's own
 * server-side code rather than an arbitrary direct caller.
 */
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  findForProduct(@Query() query: QueryReviewDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 5;
    return this.reviews.listForProduct(
      query.productId,
      page,
      limit,
      query.authorPhone ?? null,
    );
  }

  @Put()
  @UseGuards(InternalServiceGuard)
  upsert(@Body() dto: UpsertReviewDto, @VerifiedPhone() authorPhone: string) {
    return this.reviews.upsert(dto, authorPhone);
  }

  @Get('mine')
  @UseGuards(InternalServiceGuard)
  findOwn(@Query() query: OwnReviewQueryDto, @VerifiedPhone() phone: string) {
    return this.reviews.getOwn(query.productId, phone);
  }

  @Get('purchase-check')
  @UseGuards(InternalServiceGuard)
  purchaseCheck(
    @Query() query: PurchaseCheckQueryDto,
    @VerifiedPhone() phone: string,
  ) {
    return this.reviews
      .hasPurchased(query.productId, phone)
      .then((purchased) => ({ purchased }));
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('reviews:read')
  findAll(@Query() query: QueryAdminReviewDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.reviews.listAll(page, limit, query.productId);
  }

  @Patch(':id/approval')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('reviews:update')
  setApproval(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.setApproval(id, dto.isApproved);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('reviews:delete')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
