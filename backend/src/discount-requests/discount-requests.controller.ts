import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { DiscountRequestsService } from './discount-requests.service';
import { DecideDiscountDto } from './dto/decide-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DIRECTOR_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

/** The director's discount approval queue. Every route here is director+. */
@Controller('discount-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DIRECTOR_UP)
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
