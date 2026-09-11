import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import {
  AuditAction,
  CashierShiftStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class CashierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  current(actor: AuthenticatedUser) {
    return this.prisma.cashierShift.findFirst({
      where: { sellerId: actor.id, status: CashierShiftStatus.OPEN },
      orderBy: { openedAt: 'desc' },
    });
  }

  async open(actor: AuthenticatedUser, dto: OpenShiftDto) {
    const existing = await this.current(actor);
    if (existing) {
      throw new ConflictException({
        error: 'shift_already_open',
        message: 'Avval ochilgan smena mavjud — uni yoping',
      });
    }

    let warehouseId = dto.warehouseId ?? null;
    if (!warehouseId) {
      const seller = await this.prisma.seller.findUnique({
        where: { userId: actor.id },
        select: { warehouseId: true },
      });
      warehouseId = seller?.warehouseId ?? null;
    }

    const shift = await this.prisma.cashierShift.create({
      data: {
        sellerId: actor.id,
        warehouseId,
        openingBalance: new Prisma.Decimal(dto.openingBalance),
        status: CashierShiftStatus.OPEN,
      },
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'CashierShift',
      entityId: shift.id,
      after: { openingBalance: dto.openingBalance },
    });

    return shift;
  }

  /**
   * `expectedBalance = openingBalance + cashSales - cashRefunds`, both summed
   * over the shift's own window (`openedAt` .. now) and scoped to this
   * seller's own sales/returns — a shared till would need to sum across
   * every seller on the shift's warehouse instead, which is out of scope
   * here (one seller, one drawer).
   */
  async close(actor: AuthenticatedUser, dto: CloseShiftDto) {
    const shift = await this.current(actor);
    if (!shift) {
      throw new NotFoundException({
        error: 'no_open_shift',
        message: 'Ochiq smena topilmadi',
      });
    }

    const closedAt = new Date();

    const [cashSales, cashRefunds] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          method: PaymentMethod.CASH,
          status: PaymentStatus.COMPLETED,
          paidAt: { gte: shift.openedAt, lte: closedAt },
          order: { sellerId: actor.id },
        },
        _sum: { amount: true },
      }),
      this.prisma.return.aggregate({
        where: {
          refundMethod: PaymentMethod.CASH,
          sellerId: actor.id,
          createdAt: { gte: shift.openedAt, lte: closedAt },
        },
        _sum: { refundAmount: true },
      }),
    ]);

    const cashSalesTotal = cashSales._sum.amount ?? new Prisma.Decimal(0);
    const cashRefundsTotal =
      cashRefunds._sum.refundAmount ?? new Prisma.Decimal(0);

    const expectedBalance = shift.openingBalance
      .add(cashSalesTotal)
      .sub(cashRefundsTotal);
    const actualBalance = new Prisma.Decimal(dto.closingBalanceActual);
    const difference = actualBalance.sub(expectedBalance);

    const updated = await this.prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        status: CashierShiftStatus.CLOSED,
        closingBalanceActual: actualBalance,
        expectedBalance,
        difference,
        comment: dto.comment?.trim() || null,
        closedAt,
      },
    });

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'CashierShift',
      entityId: shift.id,
      before: { status: CashierShiftStatus.OPEN },
      after: {
        status: CashierShiftStatus.CLOSED,
        expectedBalance: Number(expectedBalance),
        closingBalanceActual: Number(actualBalance),
        difference: Number(difference),
      },
    });

    return updated;
  }
}
