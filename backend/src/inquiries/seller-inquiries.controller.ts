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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { ScopeActor } from '../common/scope';
import type { AuthenticatedUser } from '../auth/auth.types';

/** The seller board: list, per-column board, claim, and update. */
@Controller('seller/inquiries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerInquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  findAll(
    @Query() query: QueryInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiries.list(toActor(user), query);
  }

  @Get('board')
  board(@CurrentUser() user: AuthenticatedUser) {
    return this.inquiries.board(toActor(user));
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inquiries.claim(id, toActor(user));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inquiries.update(id, dto, toActor(user));
  }
}

/**
 * `Inquiry.assignedSellerId` is a foreign key to `User.id` (see
 * `common/scope.ts`'s doc comment on `orderReadScope`, which points at
 * `Seller.id` instead), so the scope actor's `id` here is the signed-in
 * user's own id — not `user.sellerId`.
 */
function toActor(user: AuthenticatedUser): ScopeActor {
  return { id: user.id, role: user.role };
}
