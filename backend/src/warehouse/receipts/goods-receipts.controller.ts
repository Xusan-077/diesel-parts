import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';

/**
 * Goods receipts (stock intake). Reads are open to both roles
 * (`warehouse:read`); creating, editing, approving and cancelling intake
 * stay director-only (`warehouse:update`) — approval is the only thing that
 * moves stock, and it does so inside one transaction.
 */
@Controller('warehouse/goods-receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GoodsReceiptsController {
  constructor(private readonly receipts: GoodsReceiptsService) {}

  @Get()
  @RequirePermission('warehouse:read')
  list(@Query() query: QueryGoodsReceiptsDto) {
    return this.receipts.list(query);
  }

  @Get(':id')
  @RequirePermission('warehouse:read')
  findOne(@Param('id') id: string) {
    return this.receipts.findOne(id);
  }

  @Post()
  @RequirePermission('warehouse:update')
  create(
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.receipts.create(dto, actorId, ip);
  }

  @Patch(':id')
  @RequirePermission('warehouse:update')
  update(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: UpdateGoodsReceiptDto,
  ) {
    return this.receipts.update(id, dto, actorId, ip);
  }

  @Post(':id/approve')
  @RequirePermission('warehouse:update')
  approve(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.receipts.approve(id, actorId, ip);
  }

  @Post(':id/cancel')
  @RequirePermission('warehouse:update')
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.receipts.cancel(id, actorId, ip);
  }
}
