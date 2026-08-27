import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { extractNationalDigits, phoneTail } from '../common/phone';
import { Role } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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
   */
  async findOrCreateByPhone(phone: string, name?: string) {
    const national = extractNationalDigits(phone);
    const candidates = await this.prisma.customer.findMany({
      where: { phone: { contains: phoneTail(national) } },
      take: 1000,
    });
    const existing = candidates.find(
      (candidate) => extractNationalDigits(candidate.phone) === national,
    );
    if (existing) return existing;

    return this.prisma.customer.create({
      data: { phone, name: name ?? 'Checkout' },
    });
  }

  async create(dto: CreateCustomerDto) {
    // Customer.phone is intentionally not unique (see schema doc-comment: a
    // company switchboard can be shared by several contacts, and a seller
    // must be able to create a second card for a different contact at the
    // same number). A shared phone number across multiple Customer rows is
    // expected, valid data, so no duplicate check happens here.
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.customer.delete({ where: { id } });
    return { success: true };
  }
}
