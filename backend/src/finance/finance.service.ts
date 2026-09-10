import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  OrderPaymentStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import { paginationMeta } from '../common/dto/pagination.dto';
import {
  FinanceSummaryQueryDto,
  QueryDebtsDto,
  QueryExpensesDto,
  QueryPaymentsDto,
} from './dto/finance-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { RecordDebtPaymentDto } from './dto/record-debt-payment.dto';
import { tashkentDayRange, tashkentDayStart } from './finance-dates';

/** The two order states that count as debt. `PAID` is settled, not debt. */
const DEBT_STATUSES: OrderPaymentStatus[] = [
  OrderPaymentStatus.UNPAID,
  OrderPaymentStatus.PARTIAL,
];

const ZERO = new Prisma.Decimal(0);

function d(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/** `contains … mode: insensitive` against order number or the customer's name. */
function orderOrCustomerMatch(q: string): Prisma.OrderWhereInput {
  return {
    OR: [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
    ],
  };
}

export interface FinanceSummary {
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  totalDebt: number;
  debtorCount: number;
}

export interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: Date | null;
  order: { id: string; orderNumber: string };
  customer: { id: string; name: string };
}

export interface ExpenseRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  spentAt: Date;
  note: string | null;
  createdBy: { id: string; name: string } | null;
  createdAt: Date;
}

export interface DebtRow {
  orderId: string;
  orderNumber: string;
  customer: { id: string; name: string; phone: string | null };
  total: number;
  paid: number;
  remaining: number;
  status: OrderPaymentStatus;
  createdAt: Date;
  lastPaymentAt: Date | null;
}

const EXPENSE_SELECT = {
  id: true,
  title: true,
  category: true,
  amount: true,
  spentAt: true,
  note: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseSelect;

function toExpenseRow(row: {
  id: string;
  title: string;
  category: string;
  amount: Prisma.Decimal;
  spentAt: Date;
  note: string | null;
  createdAt: Date;
  createdBy: { id: string; name: string } | null;
}): ExpenseRow {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    spentAt: row.spentAt,
    note: row.note,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
}

function expenseSnapshot(row: {
  title: string;
  category: string;
  amount: Prisma.Decimal | number;
  spentAt: Date;
  note: string | null;
}) {
  return {
    title: row.title,
    category: row.category,
    amount: Number(row.amount),
    spentAt: row.spentAt.toISOString(),
    note: row.note,
  };
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- summary ----------------------------------------------------------

  async summary(query: FinanceSummaryQueryDto): Promise<FinanceSummary> {
    const range = tashkentDayRange(query.dateFrom, query.dateTo);

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.COMPLETED,
    };
    if (range.gte || range.lt) {
      paymentWhere.paidAt = { ...range };
    }

    const expenseWhere: Prisma.ExpenseWhereInput = {};
    if (range.gte || range.lt) {
      expenseWhere.spentAt = { ...range };
    }

    const [income, expense, debtOrders] = await Promise.all([
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: expenseWhere,
        _sum: { amount: true },
      }),
      this.prisma.order.findMany({
        where: { paymentStatus: { in: DEBT_STATUSES } },
        select: { id: true, totalAmount: true },
      }),
    ]);

    const paidByOrder = await this.completedPaidByOrder(
      this.prisma,
      debtOrders.map((order) => order.id),
    );

    let totalDebt = ZERO;
    for (const order of debtOrders) {
      const paid = paidByOrder.get(order.id)?.paid ?? ZERO;
      const remaining = Prisma.Decimal.max(
        ZERO,
        d(order.totalAmount).sub(paid),
      );
      totalDebt = totalDebt.add(remaining);
    }

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpense = Number(expense._sum.amount ?? 0);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalDebt: Number(totalDebt),
      // Same population the debt tab counts ("N ta qarzdor") — every order on
      // credit, so the KPI and the list never disagree.
      debtorCount: debtOrders.length,
    };
  }

  // --- payments (income ledger) ----------------------------------------

  async payments(query: QueryPaymentsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const range = tashkentDayRange(query.dateFrom, query.dateTo);

    const where: Prisma.PaymentWhereInput = {
      status: PaymentStatus.COMPLETED,
    };
    if (query.method) where.method = query.method;
    if (range.gte || range.lt) where.paidAt = { ...range };
    if (query.q) where.order = orderOrCustomerMatch(query.q);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          method: true,
          paidAt: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    const data: PaymentRow[] = rows.map((row) => ({
      id: row.id,
      amount: Number(row.amount),
      method: row.method,
      paidAt: row.paidAt,
      order: { id: row.order.id, orderNumber: row.order.orderNumber },
      customer: { id: row.order.customer.id, name: row.order.customer.name },
    }));

    return { data, meta: paginationMeta(page, limit, total) };
  }

  // --- expenses -------------------------------------------------------

  async listExpenses(query: QueryExpensesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const range = tashkentDayRange(query.dateFrom, query.dateTo);

    const where: Prisma.ExpenseWhereInput = {};
    if (query.category) where.category = query.category;
    if (range.gte || range.lt) where.spentAt = { ...range };
    if (query.q) where.title = { contains: query.q, mode: 'insensitive' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        orderBy: { spentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: EXPENSE_SELECT,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: rows.map(toExpenseRow),
      meta: paginationMeta(page, limit, total),
    };
  }

  async createExpense(
    dto: CreateExpenseDto,
    actorId: string,
    ip?: string,
  ): Promise<ExpenseRow> {
    const expense = await this.prisma.expense.create({
      data: {
        title: dto.title,
        category: dto.category,
        amount: d(dto.amount),
        spentAt: tashkentDayStart(dto.spentAt),
        note: dto.note ?? null,
        createdById: actorId,
      },
      select: EXPENSE_SELECT,
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Expense',
      entityId: expense.id,
      after: expenseSnapshot(expense),
      ipAddress: ip,
    });

    return toExpenseRow(expense);
  }

  async updateExpense(
    id: string,
    dto: UpdateExpenseDto,
    actorId: string,
    ip?: string,
  ): Promise<ExpenseRow> {
    const before = await this.prisma.expense.findUnique({
      where: { id },
      select: EXPENSE_SELECT,
    });
    if (!before) throw new NotFoundException('Xarajat topilmadi');

    const data: Prisma.ExpenseUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.amount !== undefined) data.amount = d(dto.amount);
    if (dto.spentAt !== undefined) data.spentAt = tashkentDayStart(dto.spentAt);
    if (dto.note !== undefined) data.note = dto.note ?? null;

    const after = await this.prisma.expense.update({
      where: { id },
      data,
      select: EXPENSE_SELECT,
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Expense',
      entityId: id,
      before: expenseSnapshot(before),
      after: expenseSnapshot(after),
      ipAddress: ip,
    });

    return toExpenseRow(after);
  }

  async deleteExpense(
    id: string,
    actorId: string,
    ip?: string,
  ): Promise<{ success: true }> {
    const before = await this.prisma.expense.findUnique({
      where: { id },
      select: EXPENSE_SELECT,
    });
    if (!before) throw new NotFoundException('Xarajat topilmadi');

    await this.prisma.expense.delete({ where: { id } });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'Expense',
      entityId: id,
      before: expenseSnapshot(before),
      ipAddress: ip,
    });

    return { success: true };
  }

  // --- debts ---------------------------------------------------------

  async debts(query: QueryDebtsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OrderWhereInput = {
      paymentStatus: { in: query.status ? [query.status] : DEBT_STATUSES },
    };
    if (query.q) where.OR = orderOrCustomerMatch(query.q).OR;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        totalAmount: true,
        paymentStatus: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    const paidByOrder = await this.completedPaidByOrder(
      this.prisma,
      orders.map((order) => order.id),
    );

    let totalsRemaining = ZERO;
    const rows: DebtRow[] = orders.map((order) => {
      const paidInfo = paidByOrder.get(order.id);
      const total = d(order.totalAmount);
      const paid = paidInfo?.paid ?? ZERO;
      const remaining = Prisma.Decimal.max(ZERO, total.sub(paid));
      totalsRemaining = totalsRemaining.add(remaining);
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        total: Number(total),
        paid: Number(paid),
        remaining: Number(remaining),
        status: order.paymentStatus,
        createdAt: order.createdAt,
        lastPaymentAt: paidInfo?.lastPaymentAt ?? null,
      };
    });

    const start = (page - 1) * limit;
    return {
      data: rows.slice(start, start + limit),
      meta: paginationMeta(page, limit, rows.length),
      totals: { remaining: Number(totalsRemaining), count: rows.length },
    };
  }

  async recordDebtPayment(
    orderId: string,
    dto: RecordDebtPaymentDto,
    actorId: string,
    ip?: string,
  ): Promise<DebtRow> {
    const paidAt = dto.paidAt ? tashkentDayStart(dto.paidAt) : new Date();
    const amount = d(dto.amount);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          totalAmount: true,
          paymentStatus: true,
          customer: { select: { id: true, name: true, phone: true } },
        },
      });
      if (!order) throw new NotFoundException('Buyurtma topilmadi');

      const paidBeforeAgg = await tx.payment.aggregate({
        where: { orderId, status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      });
      const paidBefore = d(paidBeforeAgg._sum.amount ?? 0);
      const total = d(order.totalAmount);
      const remaining = total.sub(paidBefore);

      if (amount.lte(0)) {
        throw new BadRequestException(
          "To'lov summasi noldan katta bo'lishi kerak",
        );
      }
      if (amount.gt(remaining)) {
        throw new BadRequestException(
          "To'lov summasi qarz qoldig'idan oshib ketdi",
        );
      }

      await tx.payment.create({
        data: {
          orderId,
          amount,
          method: dto.method,
          status: PaymentStatus.COMPLETED,
          paidAt,
        },
      });

      const paidAfter = paidBefore.add(amount);
      const nextStatus = paidAfter.gte(total)
        ? OrderPaymentStatus.PAID
        : OrderPaymentStatus.PARTIAL;

      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: nextStatus },
      });

      return { order, paidAfter, nextStatus };
    });

    await this.audit.record({
      userId: actorId,
      action: AuditAction.PAYMENT,
      entityType: 'Order',
      entityId: orderId,
      before: { paymentStatus: outcome.order.paymentStatus },
      after: {
        paymentStatus: outcome.nextStatus,
        amount: Number(amount),
        method: dto.method,
        paidAt: paidAt.toISOString(),
      },
      ipAddress: ip,
    });

    const total = d(outcome.order.totalAmount);
    const remaining = Prisma.Decimal.max(ZERO, total.sub(outcome.paidAfter));

    return {
      orderId: outcome.order.id,
      orderNumber: outcome.order.orderNumber,
      customer: outcome.order.customer,
      total: Number(total),
      paid: Number(outcome.paidAfter),
      remaining: Number(remaining),
      status: outcome.nextStatus,
      createdAt: outcome.order.createdAt,
      lastPaymentAt: paidAt,
    };
  }

  // --- internals -----------------------------------------------------

  /** `orderId → { paid, lastPaymentAt }` over COMPLETED payments only. */
  private async completedPaidByOrder(
    client: Pick<PrismaService, 'payment'>,
    orderIds: string[],
  ): Promise<
    Map<string, { paid: Prisma.Decimal; lastPaymentAt: Date | null }>
  > {
    if (orderIds.length === 0) return new Map();

    const grouped = await client.payment.groupBy({
      by: ['orderId'],
      where: { orderId: { in: orderIds }, status: PaymentStatus.COMPLETED },
      _sum: { amount: true },
      _max: { paidAt: true },
    });

    return new Map(
      grouped.map((row) => [
        row.orderId,
        {
          paid: d(row._sum.amount ?? 0),
          lastPaymentAt: row._max.paidAt ?? null,
        },
      ]),
    );
  }
}
