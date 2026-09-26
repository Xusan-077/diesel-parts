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
import { SellersService } from './sellers.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('sellers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('users:read')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  findAll() {
    return this.sellers.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sellers.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSellerDto) {
    return this.sellers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSellerDto) {
    return this.sellers.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sellers.remove(id);
  }
}
