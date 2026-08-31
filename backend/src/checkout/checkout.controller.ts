import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { VerifiedPhone } from '../common/decorators/verified-phone.decorator';

@Controller('checkout')
@UseGuards(InternalServiceGuard)
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  create(@VerifiedPhone() phone: string, @Body() dto: CreateCheckoutDto) {
    return this.checkout.createOrder(phone, dto);
  }

  @Get('orders/:id')
  getStatus(@VerifiedPhone() phone: string, @Param('id') id: string) {
    return this.checkout.getOrderStatus(phone, id);
  }
}
