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
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission('categories:read')
  findAll() {
    return this.categories.findAll();
  }

  @Get(':id')
  @RequirePermission('categories:read')
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @RequirePermission('categories:create')
  create(@CurrentUser('id') actorId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermission('categories:update')
  update(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto, actorId);
  }

  @Delete(':id')
  @RequirePermission('categories:delete')
  remove(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.categories.remove(id, actorId);
  }
}
