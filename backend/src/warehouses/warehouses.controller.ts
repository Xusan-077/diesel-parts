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
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ALL_ROLES, MANAGER_UP } from '../common/roles';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @Roles(...ALL_ROLES)
  findAll() {
    return this.warehouses.findAll();
  }

  @Get(':id')
  @Roles(...ALL_ROLES)
  findOne(@Param('id') id: string) {
    return this.warehouses.findOne(id);
  }

  @Post()
  @Roles(...MANAGER_UP)
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Patch(':id')
  @Roles(...MANAGER_UP)
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGER_UP)
  remove(@Param('id') id: string) {
    return this.warehouses.remove(id);
  }
}
