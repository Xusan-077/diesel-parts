import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditAction, OrderStatus, Role } from '../../generated/prisma/client';

const SAFE_SELECT = {
  id: true,
  phone: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** What the audit trail keeps for a staff write — never the password hash. */
function auditSnapshot(row: {
  phone: string | null;
  role: Role;
  isActive: boolean;
}) {
  return { phone: row.phone, role: row.role, isActive: row.isActive };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ported from lib/api/user-repository.ts's listStaff: same groupBy shape
   * (`by: ['sellerId'], where: { status: 'COMPLETED' }, _count: { _all: true }`),
   * so a director sees who is active. Unlike root — where Order.sellerId
   * points straight at User — this schema's Order.sellerId points at the
   * Seller profile (Seller.userId -> User), so the per-seller counts are
   * re-keyed to userId through a Seller lookup before merging into the list.
   */
  async findAll() {
    const [users, orderCounts, sellers] = await Promise.all([
      this.prisma.user.findMany({
        select: SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.groupBy({
        by: ['sellerId'],
        where: { status: OrderStatus.COMPLETED },
        _count: { _all: true },
      }),
      this.prisma.seller.findMany({ select: { id: true, userId: true } }),
    ]);

    const userIdBySellerId = new Map(sellers.map((s) => [s.id, s.userId]));
    const completedOrdersByUserId = new Map<string, number>();
    for (const row of orderCounts) {
      const userId = userIdBySellerId.get(row.sellerId);
      if (userId) {
        completedOrdersByUserId.set(userId, row._count._all);
      }
    }

    return users.map((user) => ({
      ...user,
      completedOrders: completedOrdersByUserId.get(user.id) ?? 0,
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: SAFE_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (existing)
      throw new ConflictException('Phone number already registered');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        isActive: dto.isActive ?? true,
      },
      select: SAFE_SELECT,
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: created.id,
      after: auditSnapshot(created),
    });
    return created;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.findOne(id);
    await this.assertLastActiveDirectorSafe(
      id,
      before.role,
      dto.role ?? before.role,
      dto.isActive ?? before.isActive,
    );
    const after = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: SAFE_SELECT,
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return after;
  }

  async remove(id: string, actorId: string) {
    const before = await this.findOne(id);
    await this.assertLastActiveDirectorSafe(
      id,
      before.role,
      before.role,
      false,
    );
    await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'User',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot({ ...before, isActive: false }),
    });
    return { success: true };
  }

  /**
   * Counts directors other than `excludeId` who could still sign in. Ported
   * from lib/api/user-repository.ts's otherActiveDirectors: guards the one
   * change that locks everybody out — the last director demoting or
   * deactivating themselves. There is no recovery path from that short of a
   * database console.
   */
  private async otherActiveDirectors(excludeId: string): Promise<number> {
    return this.prisma.user.count({
      where: { role: Role.DIRECTOR, isActive: true, id: { not: excludeId } },
    });
  }

  /**
   * Ported from lib/api/user-repository.ts's updateStaff `losingDirector`
   * check. Root always receives a full form submission, so it compares
   * `input.role`/`input.isActive` directly; this DTO is a PATCH (partial),
   * so `nextRole`/`nextIsActive` are pre-resolved by the caller (falling
   * back to the current value when the field isn't in the patch) before
   * being passed in here.
   */
  private async assertLastActiveDirectorSafe(
    id: string,
    currentRole: Role,
    nextRole: Role,
    nextIsActive: boolean,
  ) {
    const losingDirector =
      currentRole === Role.DIRECTOR &&
      (nextRole !== Role.DIRECTOR || !nextIsActive);
    if (!losingDirector) return;

    if ((await this.otherActiveDirectors(id)) === 0) {
      throw new ConflictException('Cannot deactivate the last active director');
    }
  }
}
