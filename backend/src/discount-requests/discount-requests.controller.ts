import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { DiscountRequestsService } from './discount-requests.service';
import { DecideDiscountDto } from './dto/decide-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

/** The director's discount approval queue — director-only. */
@Controller('discount-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('discounts:approve')
export class DiscountRequestsController {
  constructor(private readonly discountRequests: DiscountRequestsService) {}

  @Get()
  findPending() {
    return this.discountRequests.listPending();
  }

  @Patch(':id/decision')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideDiscountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.discountRequests.decide(
      id,
      dto.approve,
      user.id,
      dto.note ?? null,
    );
  }
}
