import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../../generated/prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findMine(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId)
      throw new ForbiddenException('Not your notification');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  create(
    userId: string,
    type: NotificationType,
    message: string,
    entityId?: string,
  ) {
    return this.prisma.notification.create({
      data: { userId, type, message, entityId },
    });
  }
}
