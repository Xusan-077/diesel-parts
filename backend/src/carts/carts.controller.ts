import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { SetCartItemDto } from './dto/set-cart-item.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { VerifiedPhone } from '../common/decorators/verified-phone.decorator';

/**
 * A phone-verified storefront visitor's cart. Every route requires the
 * internal-service HMAC proving the call came from Next.js's own
 * server-side code carrying an OTP-verified phone — see
 * InternalServiceGuard's doc comment. There is no guest/anonymous cart
 * here; that stays client-side (localStorage) in Next.js until login.
 */
@Controller('carts')
@UseGuards(InternalServiceGuard)
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Get()
  getCart(@VerifiedPhone() phone: string) {
    return this.carts.getCart(phone);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@VerifiedPhone() phone: string) {
    await this.carts.clear(phone);
  }

  @Put('items')
  setItem(@VerifiedPhone() phone: string, @Body() dto: SetCartItemDto) {
    return this.carts.setItem(phone, dto.productId, dto.quantity);
  }

  @Delete('items/:productId')
  removeItem(
    @VerifiedPhone() phone: string,
    @Param('productId') productId: string,
  ) {
    return this.carts.removeItem(phone, productId);
  }

  @Post('merge')
  merge(@VerifiedPhone() phone: string, @Body() dto: MergeCartDto) {
    return this.carts.mergeGuest(phone, dto.items);
  }
}
