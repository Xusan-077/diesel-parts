import {
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
import { extractNationalDigits, phoneTail } from '../common/phone';
import { AuditAction, Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

/** The fields a staff write to a customer can move; what the trail keeps. */
function auditSnapshot(row: {
  name: string;
  phone: string;
  telegram: string | null;
}) {
  return { name: row.name, phone: row.phone, telegram: row.telegram };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryCustomerDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { phone: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return { data, meta: paginationMeta(page, limit, total) };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
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
      where.sellerId = actor.sellerId;
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

  async create(dto: CreateCustomerDto, actorId: string) {
    // Customer.phone is intentionally not unique (see schema doc-comment: a
    // company switchboard can be shared by several contacts, and a seller
    // must be able to create a second card for a different contact at the
    // same number). A shared phone number across multiple Customer rows is
    // expected, valid data, so no duplicate check happens here.
    const created = await this.prisma.customer.create({ data: dto });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Customer',
      entityId: created.id,
      after: auditSnapshot(created),
    });
    return created;
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const before = await this.findOne(id);
    const after = await this.prisma.customer.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Customer',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return after;
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
