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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ALL_ROLES, MANAGER_UP } from '../common/roles';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  findAll() {
    return this.categories.findAll();
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  findOne(@Param('id') id: string) {
    return this.categories.findOne(id);
  }

  @Post()
  @Roles(...MANAGER_UP)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @Roles(...MANAGER_UP)
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGER_UP)
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
