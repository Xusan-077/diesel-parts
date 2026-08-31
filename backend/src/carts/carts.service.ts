import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mergeCartItems, type CartItemRow } from './cart-merge';

export interface CartResult {
  items: CartItemRow[];
}

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(phone: string): Promise<CartResult> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { items: { select: { productId: true, quantity: true } } },
    });
    return { items: cart?.items ?? [] };
  }

  private async getOrCreateCartId(phone: string): Promise<string> {
    const cart = await this.prisma.cart.upsert({
      where: { phone },
      create: { phone },
      update: {},
      select: { id: true },
    });
    return cart.id;
  }

  async setItem(
    phone: string,
    productId: string,
    quantity: number,
  ): Promise<CartResult> {
    const cartId = await this.getOrCreateCartId(phone);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity },
    });
    return this.getCart(phone);
  }

  async removeItem(phone: string, productId: string): Promise<CartResult> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    return this.getCart(phone);
  }

  async clear(phone: string): Promise<void> {
    const cart = await this.prisma.cart.findUnique({
      where: { phone },
      select: { id: true },
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
  }

  async mergeGuest(
    phone: string,
    guestItems: readonly CartItemRow[],
  ): Promise<CartResult> {
    if (guestItems.length === 0) return this.getCart(phone);

    const server = await this.getCart(phone);
    const merged = mergeCartItems(server.items, guestItems);
    const cartId = await this.getOrCreateCartId(phone);

    await this.prisma.$transaction(
      merged.map((item) =>
        this.prisma.cartItem.upsert({
          where: { cartId_productId: { cartId, productId: item.productId } },
          create: {
            cartId,
            productId: item.productId,
            quantity: item.quantity,
          },
          update: { quantity: item.quantity },
        }),
      ),
    );

    return { items: merged };
  }
}
