import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  findAll(@Query() query: QueryCustomerDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Get(':id/orders')
  findOrders(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: PaginationDto,
  ) {
    return this.customers.findOrders(actor, id, {
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
