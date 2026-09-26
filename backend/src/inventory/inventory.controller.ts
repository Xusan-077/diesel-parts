import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission('warehouse:read')
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventory.findAll(query);
  }

  @Post('adjust')
  @RequirePermission('warehouse:update')
  adjust(@Body() dto: AdjustInventoryDto, @CurrentUser('id') userId: string) {
    return this.inventory.adjust(dto, userId);
  }
}
