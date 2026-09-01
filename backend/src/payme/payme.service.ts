import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toTiyin, paymeState } from './payme-money';
import { PAYME_ERROR } from './payme-errors';
import {
  OrderPaymentStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';

type PaymeResult<T> =
  { result: T } | { error: { code: number; message: string } };

interface CheckPerformParams {
  amount: number;
  account: { order_id: string };
}

interface CreateParams extends CheckPerformParams {
  id: string;
  time: number;
}

/**
 * The Merchant API Payme calls into. Confirmed against
 * developer.help.paycom.uz's Merchant API method/error-code pages this
 * session — field names, error codes, and every idempotent-replay rule
 * below are sourced from there, not guessed.
 *
 * This is the only path that may ever move a Payment to COMPLETED — the
 * frontend can never self-report a successful payment.
 */
@Injectable()
export class PaymeService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrder(orderId: string) {
    return this.prisma.order.findUnique({ where: { id: orderId } });
  }

  private amountMismatch(
    orderTotal: Prisma.Decimal,
    amountTiyin: number,
  ): boolean {
    return toTiyin(orderTotal) !== amountTiyin;
  }

  async checkPerformTransaction(
    params: CheckPerformParams,
  ): Promise<PaymeResult<{ allow: true }>> {
    const order = await this.findOrder(params.account.order_id);
    if (!order) {
      return {
        error: {
          code: PAYME_ERROR.ACCOUNT_ERROR,
          message: 'Buyurtma topilmadi',
        },
      };
    }
    if (this.amountMismatch(order.totalAmount, params.amount)) {
      return {
        error: { code: PAYME_ERROR.INVALID_AMOUNT, message: 'Неверная сумма' },
      };
    }
    return { result: { allow: true } };
  }

  async createTransaction(
    params: CreateParams,
  ): Promise<
    PaymeResult<{ create_time: number; transaction: string; state: number }>
  > {
    const order = await this.findOrder(params.account.order_id);
    if (!order) {
      return {
        error: {
          code: PAYME_ERROR.ACCOUNT_ERROR,
          message: 'Buyurtma topilmadi',
        },
      };
    }
    if (this.amountMismatch(order.totalAmount, params.amount)) {
      return {
        error: { code: PAYME_ERROR.INVALID_AMOUNT, message: 'Неверная сумма' },
      };
    }

    const existing = await this.prisma.payment.findFirst({
      where: { provider: 'payme', transactionId: params.id },
    });

    if (existing) {
      if (
        existing.status === PaymentStatus.PENDING ||
        existing.status === PaymentStatus.COMPLETED
      ) {
        return {
          result: {
            create_time: Number(existing.providerCreateTime),
            transaction: existing.id,
            state: paymeState(existing.status),
          },
        };
      }
      return {
        error: {
          code: PAYME_ERROR.CANNOT_PERFORM,
          message: 'Невозможно выполнить операцию',
        },
      };
    }

    const created = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalAmount,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        provider: 'payme',
        transactionId: params.id,
        providerCreateTime: BigInt(params.time),
      },
    });

    return {
      result: {
        create_time: Number(created.providerCreateTime),
        transaction: created.id,
        state: 1,
      },
    };
  }

  private async findPayment(transactionId: string) {
    return this.prisma.payment.findFirst({
      where: { provider: 'payme', transactionId },
    });
  }

  /**
   * Same aggregate-then-update shape as PaymentsService.create (the
   * staff-driven payment path) — one COMPLETED-sum aggregate, compared
   * against Order.totalAmount with Prisma.Decimal's own comparison methods, not a
   * second copy of that logic with different arithmetic.
   */
  private async recomputeOrderPaymentStatus(
    tx: Pick<PrismaService, 'order' | 'payment'>,
    orderId: string,
  ): Promise<void> {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const paidSoFar = await tx.payment.aggregate({
      where: { orderId, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
    });
    const totalPaid = paidSoFar._sum.amount ?? new Prisma.Decimal(0);

    const paymentStatus = totalPaid.gte(order.totalAmount)
      ? OrderPaymentStatus.PAID
      : totalPaid.gt(0)
        ? OrderPaymentStatus.PARTIAL
        : OrderPaymentStatus.UNPAID;

    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus },
    });
  }

  async performTransaction(params: {
    id: string;
  }): Promise<
    PaymeResult<{ transaction: string; perform_time: number; state: number }>
  > {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: {
          code: PAYME_ERROR.TRANSACTION_NOT_FOUND,
          message: 'Транзакция не найдена',
        },
      };
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        result: {
          transaction: payment.id,
          perform_time: payment.paidAt!.getTime(),
          state: 2,
        },
      };
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return {
        error: {
          code: PAYME_ERROR.CANNOT_PERFORM,
          message: 'Невозможно выполнить операцию',
        },
      };
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
      });
      await this.recomputeOrderPaymentStatus(tx, payment.orderId);
      return result;
    });

    return {
      result: {
        transaction: updated.id,
        perform_time: updated.paidAt!.getTime(),
        state: 2,
      },
    };
  }

  async cancelTransaction(params: {
    id: string;
    reason: number;
  }): Promise<
    PaymeResult<{ transaction: string; cancel_time: number; state: number }>
  > {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: {
          code: PAYME_ERROR.TRANSACTION_NOT_FOUND,
          message: 'Транзакция не найдена',
        },
      };
    }

    if (
      payment.status === PaymentStatus.FAILED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      return {
        result: {
          transaction: payment.id,
          cancel_time: payment.cancelledAt!.getTime(),
          state: paymeState(payment.status),
        },
      };
    }

    const nextStatus =
      payment.status === PaymentStatus.COMPLETED
        ? PaymentStatus.REFUNDED
        : PaymentStatus.FAILED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          cancelledAt: new Date(),
          cancelReason: params.reason,
        },
      });
      await this.recomputeOrderPaymentStatus(tx, payment.orderId);
      return result;
    });

    return {
      result: {
        transaction: updated.id,
        cancel_time: updated.cancelledAt!.getTime(),
        state: paymeState(nextStatus),
      },
    };
  }

  async checkTransaction(params: { id: string }): Promise<
    PaymeResult<{
      create_time: number;
      perform_time: number;
      cancel_time: number;
      transaction: string;
      state: number;
      reason: number | null;
    }>
  > {
    const payment = await this.findPayment(params.id);
    if (!payment) {
      return {
        error: {
          code: PAYME_ERROR.TRANSACTION_NOT_FOUND,
          message: 'Транзакция не найдена',
        },
      };
    }

    return {
      result: {
        create_time: Number(payment.providerCreateTime ?? 0),
        perform_time: payment.paidAt?.getTime() ?? 0,
        cancel_time: payment.cancelledAt?.getTime() ?? 0,
        transaction: payment.id,
        state: paymeState(payment.status),
        reason: payment.cancelReason,
      },
    };
  }
}
