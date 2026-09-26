import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { QueryReturnDto } from './dto/query-return.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/returns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermission('orders:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReturnDto,
  ) {
    return this.returns.findAll(actor, query);
  }

  @Get(':id')
  @RequirePermission('orders:read')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.returns.findOne(actor, id);
  }

  @Post()
  @RequirePermission('orders:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.create(actor, dto);
  }
}
