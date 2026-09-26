import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Users/Settings management. 403 for SELLER by construction (director-only permission). */
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('users:read')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Post()
  create(@CurrentUser('id') actorId: string, @Body() dto: CreateUserDto) {
    return this.users.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, dto, actorId);
  }

  @Delete(':id')
  remove(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.users.remove(id, actorId);
  }
}
