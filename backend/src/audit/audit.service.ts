import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginationMeta } from '../common/dto/pagination.dto';
import { AuditAction, Prisma } from '../../generated/prisma/client';

export interface AuditEntry {
  /** Null for an action taken before anyone was identified, such as a failed login. */
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** Fixed page size for the audit trail listing (not client-configurable). */
const AUDIT_PAGE_SIZE = 30;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes one line of the audit trail.
   *
   * Never throws: an audit write failing must not turn a completed action into
   * an error the caller sees, and must not roll back the thing that was
   * audited. The failure is logged so it can still be noticed.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: entry.before as Prisma.InputJsonValue | undefined,
          after: entry.after as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record ${entry.action} ${entry.entityType}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(page: number, entityType?: string) {
    const where = entityType ? { entityType } : {};

    const total = await this.prisma.auditLog.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
    const current = Math.min(Math.max(1, page), totalPages);

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (current - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
      include: { user: { select: { name: true } } },
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        // Null once the acting account is deleted; the trail outlives it.
        actorName: row.user?.name ?? null,
        before: row.before,
        after: row.after,
        createdAt: row.createdAt,
      })),
      meta: paginationMeta(current, AUDIT_PAGE_SIZE, total),
    };
  }

  /** Distinct entity types present, so the filter dropdown offers only what exists. */
  async findEntityTypes(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });
    return rows.map((row) => row.entityType);
  }
}
