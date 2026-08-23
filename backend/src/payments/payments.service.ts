import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { assertOrderVisible } from '../common/order-access';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  OrderPaymentStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrder(actor: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(actor: AuthenticatedUser, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: { select: { sellerId: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    assertOrderVisible(actor, payment.order.sellerId);
    return payment;
  }

  async create(actor: AuthenticatedUser, dto: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: dto.orderId,
          amount: new Prisma.Decimal(dto.amount),
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        },
      });

      const paidSoFar = await tx.payment.aggregate({
        where: { orderId: dto.orderId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      const totalPaid = paidSoFar._sum.amount ?? new Prisma.Decimal(0);

      const paymentStatus = totalPaid.gte(order.total)
        ? OrderPaymentStatus.PAID
        : totalPaid.gt(0)
          ? OrderPaymentStatus.PARTIAL
          : OrderPaymentStatus.UNPAID;

      await tx.order.update({
        where: { id: dto.orderId },
        data: { paymentStatus },
      });

      return payment;
    });
  }
}
