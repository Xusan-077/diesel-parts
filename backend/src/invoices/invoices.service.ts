import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { assertOrderVisible } from '../common/order-access';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrder(actor: AuthenticatedUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { sellerId: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    const invoice = await this.prisma.invoice.findUnique({
      where: { orderId },
    });
    if (!invoice) throw new NotFoundException('This order has no invoice yet');
    return invoice;
  }

  async create(actor: AuthenticatedUser, dto: CreateInvoiceDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) throw new NotFoundException('Order not found');
    assertOrderVisible(actor, order.sellerId);

    const existing = await this.prisma.invoice.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existing)
      throw new ConflictException('This order already has an invoice');

    const invoiceNumber = order.orderNumber.replace('DP-', 'INV-');
    return this.prisma.invoice.create({
      data: { orderId: dto.orderId, invoiceNumber, issuedAt: new Date() },
    });
  }
}
