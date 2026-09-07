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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MANAGER_UP } from '../../common/roles';
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { UpdateGoodsReceiptDto } from './dto/update-goods-receipt.dto';
import { QueryGoodsReceiptsDto } from './dto/query-goods-receipts.dto';

/**
 * Goods receipts (stock intake). Every route is `MANAGER_UP` — creating,
 * editing and approving intake is a manager's job. Approval is the only thing
 * that moves stock, and it does so inside one transaction.
 */
@Controller('warehouse/goods-receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_UP)
export class GoodsReceiptsController {
  constructor(private readonly receipts: GoodsReceiptsService) {}

  @Get()
  list(@Query() query: QueryGoodsReceiptsDto) {
    return this.receipts.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receipts.findOne(id);
  }

  @Post()
  create(
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: CreateGoodsReceiptDto,
  ) {
    return this.receipts.create(dto, actorId, ip);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
    @Body() dto: UpdateGoodsReceiptDto,
  ) {
    return this.receipts.update(id, dto, actorId, ip);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.receipts.approve(id, actorId, ip);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Ip() ip: string,
  ) {
    return this.receipts.cancel(id, actorId, ip);
  }
}
