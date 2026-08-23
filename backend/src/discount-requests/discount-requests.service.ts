import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  DiscountStatus,
  NotificationType,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { applyDiscount } from './order-money';

/**
 * The director's discount queue: listing what a seller asked for above their
 * limit, and approving or rejecting it.
 *
 * Ported from the root Next.js app's `lib/api/discount-repository.ts`
 * (`listPendingDiscounts`/`decideDiscount`). Requesting a discount
 * (`requestOrderDiscount`) is not here — it is an order-mutation endpoint
 * that belongs to the Orders module (Task 10 of the backend consolidation
 * plan). `listAudit`/`listAuditEntityTypes`, also in the source file, were
 * already ported into the Audit module (Task 5) and are out of scope here.
 */
@Injectable()
export class DiscountRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Every request still waiting on a director, oldest first. */
  async listPending() {
    const rows = await this.prisma.discountRequest.findMany({
      where: { status: DiscountStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        seller: { select: { name: true, discountLimit: true } },
        order: {
          select: {
            orderNumber: true,
            subtotal: true,
            customer: { select: { name: true } },
          },
        },
      },
    });

    return rows.map((row) => {
      const subtotal = Number(row.order.subtotal);
      const percent = Number(row.requestedPercent);

      return {
        id: row.id,
        orderId: row.orderId,
        orderNumber: row.order.orderNumber,
        sellerName: row.seller.name,
        sellerLimit: row.seller.discountLimit,
        customerName: row.order.customer.name,
        requestedPercent: percent,
        reason: row.reason,
        subtotal,
        // What the order would total if this request were approved.
        totalIfApproved: applyDiscount(subtotal, percent),
        createdAt: row.createdAt,
      };
    });
  }

  /**
   * Approves or rejects one request.
   *
   * Approval writes the percent onto the order and recomputes its total in
   * the same transaction as the decision. Two statements could otherwise
   * leave a request marked approved beside an order still priced at the old
   * total, and a seller would quote from whichever they happened to read.
   *
   * A request that no longer exists answers 404; one that has already been
   * decided answers 409 — matching this codebase's convention for a
   * compare-and-set race elsewhere (see `InquiriesService.claim`), rather
   * than the source file's `DecisionResult` return-value union.
   */
  async decide(
    id: string,
    approve: boolean,
    reviewerId: string,
    note: string | null,
  ): Promise<{ id: string }> {
    const request = await this.prisma.discountRequest.findUnique({
      where: { id },
      include: {
        order: { select: { subtotal: true, discountApprovedPercent: true } },
      },
    });

    if (request === null) {
      throw new NotFoundException('Discount request not found');
    }

    if (request.status !== DiscountStatus.PENDING) {
      throw new ConflictException('This request has already been decided');
    }

    const percent = Number(request.requestedPercent);
    const subtotal = Number(request.order.subtotal);

    await this.prisma.$transaction(async (tx) => {
      await tx.discountRequest.update({
        where: { id },
        data: {
          status: approve ? DiscountStatus.APPROVED : DiscountStatus.REJECTED,
          reviewedByUserId: reviewerId,
          reviewedAt: new Date(),
          decisionNote: note,
        },
      });

      if (approve) {
        await tx.order.update({
          where: { id: request.orderId },
          data: {
            discountApprovedPercent: new Prisma.Decimal(percent),
            total: new Prisma.Decimal(applyDiscount(subtotal, percent)),
          },
        });
      }

      // The seller is waiting on this answer and is not watching the panel.
      await tx.notification.create({
        data: {
          userId: request.sellerId,
          type: NotificationType.DISCOUNT_DECIDED,
          entityId: request.orderId,
          message: approve
            ? percent + '% chegirma tasdiqlandi.'
            : percent + '% chegirma rad etildi.' + (note ? ' ' + note : ''),
        },
      });
    });

    await this.audit.record({
      userId: reviewerId,
      action: approve ? AuditAction.APPROVE : AuditAction.REJECT,
      entityType: 'DiscountRequest',
      entityId: id,
      before: { status: DiscountStatus.PENDING, requestedPercent: percent },
      after: {
        status: approve ? DiscountStatus.APPROVED : DiscountStatus.REJECTED,
        note,
      },
    });

    return { id };
  }
}
