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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryReturnDto,
  ) {
    return this.returns.findAll(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.returns.findOne(actor, id);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.create(actor, dto);
  }
}
