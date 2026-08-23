import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOrderVisible } from '../common/order-access';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class OrderItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrder(actor: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    return this.prisma.orderItem.findMany({
      where: { orderId },
      include: { product: { select: { id: true, sku: true, nameEn: true } } },
    });
  }
}
