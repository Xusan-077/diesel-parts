import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
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

  async create(dto: CreateCustomerDto) {
    // Customer.phone is intentionally not unique (see schema doc-comment: a
    // company switchboard can be shared by several contacts), so this is a
    // best-effort duplicate warning rather than a DB-enforced constraint.
    const existing = await this.prisma.customer.findFirst({
      where: { phone: dto.phone },
    });
    if (existing)
      throw new ConflictException('A customer with this phone already exists');
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
