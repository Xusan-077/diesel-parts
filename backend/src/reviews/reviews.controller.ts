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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { MANAGER_UP } from '../common/roles';

/**
 * Guards are applied per-route rather than at the controller: most of this
 * surface is the public product page (no session, no staff account — the
 * OTP-signed-in visitor's identity is just a phone the Next.js layer passes
 * along), and only the moderation endpoints are staff-only.
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
  upsert(@Body() dto: UpsertReviewDto) {
    return this.reviews.upsert(dto);
  }

  @Get('mine')
  findOwn(@Query() query: OwnReviewQueryDto) {
    return this.reviews.getOwn(query.productId, query.authorPhone);
  }

  @Get('purchase-check')
  purchaseCheck(@Query() query: PurchaseCheckQueryDto) {
    return this.reviews
      .hasPurchased(query.productId, query.phone)
      .then((purchased) => ({ purchased }));
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_UP)
  findAll(@Query() query: QueryAdminReviewDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.reviews.listAll(page, limit, query.productId);
  }

  @Patch(':id/approval')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_UP)
  setApproval(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.setApproval(id, dto.isApproved);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...MANAGER_UP)
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }
}
