import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehousesDto } from './dto/query-warehouses.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  @RequirePermission('warehouse:read')
  findAll(@Query() query: QueryWarehousesDto) {
    return this.warehouses.findAll(query);
  }

  @Get(':id')
  @RequirePermission('warehouse:read')
  findOne(@Param('id') id: string) {
    return this.warehouses.findOne(id);
  }

  @Post()
  @RequirePermission('warehouse:create')
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehouses.create(dto);
  }

  @Patch(':id')
  @RequirePermission('warehouse:update')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehouses.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('warehouse:delete')
  remove(@Param('id') id: string) {
    return this.warehouses.remove(id);
  }
}
