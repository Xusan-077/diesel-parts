import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InquiriesService } from './inquiries.service';
import { QueryInquiryDto } from './dto/query-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { ScopeActor } from '../common/scope';
import type { AuthenticatedUser } from '../auth/auth.types';

/** The seller board: list, per-column board, claim, and update. */
@Controller('seller/inquiries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SellerInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  @RequirePermission('inquiries:read')
  findAll(
    @Query() query: QueryInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiries.list(toActor(user), query);
  }

  @Get('board')
  @RequirePermission('inquiries:read')
  board(@CurrentUser() user: AuthenticatedUser) {
    return this.inquiries.board(toActor(user));
  }

  // No `:id`-shaped GET route exists on this controller, so registration
  // order doesn't matter for this one — kept alongside `board` regardless,
  // matching the sibling `by-phone` convention in seller-customers.controller.ts.
  @Get('by-phone')
  @RequirePermission('inquiries:read')
  byPhone(
    @Query('phone') phone: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiries.byPhone(phone ?? '', toActor(user));
  }

  @Post(':id/claim')
  @RequirePermission('inquiries:update')
  claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inquiries.claim(id, toActor(user));
  }

  @Patch(':id')
  @RequirePermission('inquiries:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiries.update(id, dto, toActor(user));
  }
}

/**
 * `Inquiry.assignedSellerId` — like `Order.sellerId` — is a foreign key to
 * `User.id`, so the scope actor's `id` here is the signed-in user's own id,
 * not `user.sellerId` (which is the separate `Seller` profile id).
 */
function toActor(user: AuthenticatedUser): ScopeActor {
  return { id: user.id, role: user.role };
}
