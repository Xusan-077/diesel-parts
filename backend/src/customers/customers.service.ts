import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import {
  extractNationalDigits,
  isValidPhone,
  phoneTail,
} from '../common/phone';
import {
  customerReadScope,
  customerWriteScope,
  isDirector,
  unclaimedScope,
  type ScopeActor,
} from '../common/scope';
import { diffFields, type AuditValue } from '../common/audit-diff';
import {
  AuditAction,
  OrderStatus,
  Prisma,
  Role,
} from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * How many rows a phone match may scan.
 *
 * `Customer.phone` is whatever a seller typed by hand, so no SQL `equals` can
 * match "+998 90 123-45-67" against "998901234567" — the comparison happens
 * in JS on canonical digits, and this caps what that costs. The `contains`
 * prefilter narrows the scan to roughly one row in a hundred first, so this
 * cap is far past any real shop's history rather than a limit anyone meets.
 */
const PHONE_SCAN_LIMIT = 1000;

/** The fields a staff write to a customer can move; what the trail keeps. */
function auditSnapshot(row: {
  name: string;
  phone: string;
  telegram: string | null;
}) {
  return { name: row.name, phone: row.phone, telegram: row.telegram };
}

/** create()'s audit `after` — root's reference includes assignedSellerId, not telegram. */
function createSnapshot(row: {
  name: string;
  phone: string;
  assignedSellerId: string | null;
}): Record<string, AuditValue> {
  return {
    name: row.name,
    phone: row.phone,
    assignedSellerId: row.assignedSellerId,
  };
}

/**
 * Trims incoming string fields and turns an empty optional field into
 * `null` before a write ever reaches the database — matching root's
 * pre-rewire normalization (`name.trim()`, `phone.trim()`,
 * `email?.trim() || null`, etc.) exactly. Only touches keys actually
 * present on the DTO: `PartialType`'s omitted fields on an update must
 * stay untouched, not get forced to `null`. `telegram` is intentionally
 * excluded — it's a backend-only column root never normalized.
 */
function normalizeCustomerWrite<T extends Record<string, unknown>>(dto: T): T {
  const next: Record<string, unknown> = { ...dto };
  if (typeof next.name === 'string') next.name = next.name.trim();
  if (typeof next.phone === 'string') next.phone = next.phone.trim();
  for (const key of ['email', 'company', 'notes'] as const) {
    if (key in dto && dto[key] !== undefined) {
      const value = dto[key];
      next[key] = typeof value === 'string' ? value.trim() || null : value;
    }
  }
  return next as T;
}

/**
 * update()'s diff fields. `assignedSellerId` is deliberately excluded here —
 * only claim()'s own audit entry touches it.
 */
function updateSnapshot(row: {
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  notes: string | null;
}): Record<string, AuditValue> {
  return {
    name: row.name,
    phone: row.phone,
    email: row.email,
    company: row.company,
    notes: row.notes,
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Completed-order spend per customer, for exactly the rows a page just
   * read. A `groupBy` keyed to the page's ids rather than a per-row query.
   */
  private async spendByCustomer(
    customerIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (customerIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: [...customerIds] },
        status: OrderStatus.COMPLETED,
      },
      _sum: { totalAmount: true },
    });

    return new Map(
      rows.map((row) => [row.customerId, Number(row._sum?.totalAmount ?? 0)]),
    );
  }

  async findAll(query: QueryCustomerDto, actor?: ScopeActor) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const scope: Prisma.CustomerWhereInput = actor
      ? customerReadScope(actor, { includePool: query.pool === 'true' })
      : {};
    const searchFilter: Prisma.CustomerWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
            {
              company: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};
    const where: Prisma.CustomerWhereInput = { AND: [scope, searchFilter] };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { orders: true } },
          assignedSeller: { select: { name: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const spent = await this.spendByCustomer(rows.map((row) => row.id));
    const data = rows.map((row) => this.toRow(row, spent.get(row.id) ?? 0));

    return { data, meta: paginationMeta(page, limit, total) };
  }

  async findOne(id: string, actor?: ScopeActor) {
    const include = {
      _count: { select: { orders: true } },
      assignedSeller: { select: { name: true } },
    } as const;

    const customer = actor
      ? await this.prisma.customer.findFirst({
          where: { id, ...customerReadScope(actor, { includePool: true }) },
          include,
        })
      : await this.prisma.customer.findUnique({ where: { id }, include });

    if (!customer) throw new NotFoundException('Customer not found');

    const spent = await this.spendByCustomer([customer.id]);
    return this.toRow(customer, spent.get(customer.id) ?? 0);
  }

  /**
   * Flattens the `_count`/`assignedSeller` relations `findAll`/`findOne`
   * include into the plain `orderCount`/`assignedSellerName` fields root's
   * `CustomerRow` expects — the raw relation objects are never shipped over
   * HTTP as-is.
   */
  private toRow<
    T extends {
      _count: { orders: number };
      assignedSeller: { name: string } | null;
    },
  >(row: T, totalSpent: number) {
    const { _count, assignedSeller, ...rest } = row;
    return {
      ...rest,
      assignedSellerName: assignedSeller?.name ?? null,
      orderCount: _count.orders,
      totalSpent,
    };
  }

  async findOrders(
    actor: AuthenticatedUser,
    id: string,
    pagination: { page: number; limit: number },
  ) {
    await this.findOne(id);
    const { page, limit } = pagination;

    const where: { customerId: string; sellerId?: string } = {
      customerId: id,
    };
    if (actor.role === Role.SELLER) {
      if (!actor.sellerId) {
        throw new ForbiddenException('This account has no seller profile');
      }
      // `Order.sellerId` is a FK to `User` — scope to the actor's user id,
      // not their `Seller` profile id (`actor.sellerId`, the has-a-profile
      // gate above).
      where.sellerId = actor.id;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: paginationMeta(page, limit, total) };
  }

  /**
   * A checkout customer identified only by an OTP-verified phone — no
   * Customer row exists yet unless they have ordered before. Matched on
   * canonical digits, same scan pattern the (removed) root app used:
   * Customer.phone is free text (a seller may have typed it with different
   * formatting), so no SQL `equals` can find it — the `contains` prefilter
   * below narrows to roughly one row in a hundred before the exact
   * comparison runs in JS.
   *
   * For an existing match: `name` overwrites whenever the checkout's name
   * differs from what is on file (checkout now always collects a real name
   * — see CreateCheckoutDto — so it is the most up-to-date value available).
   * `email`/`company`/`taxId` only backfill a currently-null column, so a
   * repeat checkout can never clobber data a seller already curated on the
   * CRM side.
   */
  async findOrCreateByPhone(
    phone: string,
    details?: {
      name?: string;
      email?: string;
      company?: string;
      taxId?: string;
    },
  ) {
    const national = extractNationalDigits(phone);
    const candidates = await this.prisma.customer.findMany({
      where: { phone: { contains: phoneTail(national) } },
      take: 1000,
    });
    const existing = candidates.find(
      (candidate) => extractNationalDigits(candidate.phone) === national,
    );

    if (existing) {
      const patch: Record<string, string> = {};
      if (details?.name && details.name !== existing.name) {
        patch.name = details.name;
      }
      if (details?.email && !existing.email) {
        patch.email = details.email;
      }
      if (details?.company && !existing.company) {
        patch.company = details.company;
      }
      if (details?.taxId && !existing.taxId) {
        patch.taxId = details.taxId;
      }

      if (Object.keys(patch).length === 0) {
        return existing;
      }
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: patch,
      });
    }

    return this.prisma.customer.create({
      data: {
        phone,
        name: details?.name ?? 'Checkout',
        email: details?.email,
        company: details?.company,
        taxId: details?.taxId,
      },
    });
  }

  async create(dto: CreateCustomerDto, actorId: string, actor?: ScopeActor) {
    // Customer.phone is intentionally not unique (see schema doc-comment: a
    // company switchboard can be shared by several contacts, and a seller
    // must be able to create a second card for a different contact at the
    // same number). A shared phone number across multiple Customer rows is
    // expected, valid data, so no duplicate check happens here.
    //
    // A seller keeps what they enter. A director is not a seller, so what
    // they add lands in the pool for whoever picks the account up. When no
    // actor is given (the unscoped CustomersController path), the row lands
    // unassigned — that path is not exercised by anything this wiring uses.
    const assignedSellerId = actor
      ? isDirector(actor)
        ? null
        : actor.id
      : null;

    const normalized = normalizeCustomerWrite(
      dto as unknown as Record<string, unknown>,
    ) as unknown as CreateCustomerDto;

    const created = await this.prisma.customer.create({
      data: { ...normalized, assignedSellerId },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Customer',
      entityId: created.id,
      after: createSnapshot(created),
    });
    return created;
  }

  async update(
    id: string,
    dto: UpdateCustomerDto,
    actorId: string,
    actor?: ScopeActor,
  ) {
    // The write scope, not the read one: a seller may read a pooled customer
    // but the only write they may make against an unowned row is the claim.
    // When no actor is given (the unscoped CustomersController path), keep
    // today's plain lookup.
    const before = actor
      ? await this.prisma.customer.findFirst({
          where: { id, ...customerWriteScope(actor) },
        })
      : await this.findOne(id);

    if (before === null) {
      throw new NotFoundException('Customer not found');
    }

    const normalized = normalizeCustomerWrite(
      dto as unknown as Record<string, unknown>,
    ) as unknown as UpdateCustomerDto;

    const after = await this.prisma.customer.update({
      where: { id },
      data: normalized,
    });

    const diff = diffFields(updateSnapshot(before), updateSnapshot(after));
    if (diff !== null) {
      await this.audit.record({
        userId: actorId,
        action: AuditAction.UPDATE,
        entityType: 'Customer',
        entityId: id,
        before: diff.before,
        after: diff.after,
      });
    }

    return after;
  }

  /** Same compare-and-set as an inquiry claim, for the unassigned pool tab. */
  async claim(id: string, actor: ScopeActor): Promise<{ id: string }> {
    const claimed = await this.prisma.customer.updateMany({
      where: { id, ...unclaimedScope() },
      data: { assignedSellerId: actor.id },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.customer.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Customer not found');
      throw new ConflictException(
        'Customer already assigned to another seller',
      );
    }

    await this.audit.record({
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: id,
      before: { assignedSellerId: null },
      after: { assignedSellerId: actor.id },
    });

    return { id };
  }

  /**
   * Which of these numbers the caller already keeps a customer card for.
   *
   * Deliberately not a uniqueness check: `Customer.phone` is non-unique
   * because a company switchboard is shared by several contacts. Keyed by
   * canonical digits — the book only, never the pool: a card the seller does
   * not own is not one they have already saved.
   */
  async findByPhone(
    phones: string[],
    actor: ScopeActor,
  ): Promise<Array<{ phone: string; id: string; name: string }>> {
    const wanted = new Set(
      phones.filter(isValidPhone).map(extractNationalDigits),
    );
    if (wanted.size === 0) {
      return [];
    }

    const rows = await this.prisma.customer.findMany({
      where: {
        AND: [
          customerReadScope(actor),
          {
            OR: [...new Set([...wanted].map(phoneTail))].map((tail) => ({
              phone: { contains: tail },
            })),
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: PHONE_SCAN_LIMIT,
      select: { id: true, name: true, phone: true },
    });

    const found = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      const national = extractNationalDigits(row.phone);
      // First card wins, which is why the query orders by age.
      if (wanted.has(national) && !found.has(national)) {
        found.set(national, { id: row.id, name: row.name });
      }
    }

    return [...found.entries()].map(([phone, c]) => ({
      phone,
      id: c.id,
      name: c.name,
    }));
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    await this.prisma.customer.delete({ where: { id } });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'Customer',
      entityId: id,
      before: auditSnapshot(before),
    });
    return { success: true };
  }
}
