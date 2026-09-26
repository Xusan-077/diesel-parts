import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * The global, unscoped customer CRUD surface — reads are open to both roles,
 * but writes are director-only on purpose: a SELLER's create/update path is
 * the already-scoped `seller-customers.controller.ts`, and opening this one
 * too would let a seller write any customer record, not just their own.
 *
 * `can()`'s `customers:create/update/delete` grant is SELLER-wide (it has to
 * be, for that scoped controller) — it can't express "SELLER, but not on
 * THIS controller." `requireDirector` below is the extra, explicit check
 * that keeps the deliberate asymmetry real rather than just commented.
 */
@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customers:read')
  findAll(@Query() query: QueryCustomerDto) {
    return this.customers.findAll(query);
  }

  @Get(':id')
  @RequirePermission('customers:read')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Post()
  @RequirePermission('customers:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateCustomerDto,
  ) {
    requireDirector(actor);
    return this.customers.create(dto, actor.id);
  }

  @Patch(':id')
  @RequirePermission('customers:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    requireDirector(actor);
    return this.customers.update(id, dto, actor.id);
  }

  @Delete(':id')
  @RequirePermission('customers:delete')
  remove(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    requireDirector(actor);
    return this.customers.remove(id, actor.id);
  }
}

function requireDirector(actor: AuthenticatedUser): void {
  if (actor.role !== 'DIRECTOR') {
    throw new ForbiddenException(
      'Global customer writes are director-only — use /seller/customers',
    );
  }
}
