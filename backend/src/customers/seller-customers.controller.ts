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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { ScopeActor } from '../common/scope';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerCustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Registered before `:id` — Nest/Express match routes in registration
  // order, and `:id` would otherwise swallow this as `id = "by-phone"`.
  @Get('by-phone')
  findByPhone(
    @Query('phones') phones: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customers.findByPhone(
      (phones ?? '').split(',').filter(Boolean),
      toActor(user),
    );
  }

  @Get()
  findAll(
    @Query() query: QueryCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customers.findAll(query, toActor(user));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customers.findOne(id, toActor(user));
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

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customers.create(dto, user.id, toActor(user));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(id, dto, user.id, toActor(user));
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customers.claim(id, toActor(user));
  }
}

function toActor(user: AuthenticatedUser): ScopeActor {
  return { id: user.id, role: user.role };
}
