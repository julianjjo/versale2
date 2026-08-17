import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Not exposed as its own endpoint — called by other services (OrdersService,
  // so far) at the moment something worth telling a user about happens to
  // their order. `orderId` is optional so future notification types that
  // aren't order-related don't have to invent a fake one.
  async create(
    userId: string,
    type: NotificationType,
    message: string,
    orderId?: string,
  ) {
    return this.prisma.client.notification.create({
      data: { userId, type, message, orderId },
    });
  }

  // The bell's dropdown: this user's notifications, newest first, optionally
  // narrowed to just the unread ones. Mirrors FavoritesService#findAll's own
  // pagination shape rather than introducing a fourth one.
  async findAll(userId: string, query: Record<string, unknown> = {}) {
    const { page, limit, unreadOnly } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: { userId: string; read?: boolean } = { userId };
    if (unreadOnly === 'true' || unreadOnly === true) {
      where.read = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // Powers the bell's badge count. Deliberately its own cheap query rather
  // than `findAll(...).meta.total` with `unreadOnly` — the badge polls far
  // more often than the dropdown is ever opened, so it shouldn't pay for
  // fetching and paginating rows it never renders.
  async getUnreadCount(userId: string) {
    const count = await this.prisma.client.notification.count({
      where: { userId, read: false },
    });
    return { count };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.client.notification.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!notification) {
      throw new NotFoundException(
        `No se encontró la notificación con ID ${id}`,
      );
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'No tienes autorización para modificar esta notificación',
      );
    }

    try {
      return await this.prisma.client.notification.update({
        where: { id },
        data: { read: true },
      });
    } catch (error) {
      translatePrismaError(error, {
        // Two clicks on the same notification (a double-click, two tabs)
        // can both pass the ownership check above and then race on the
        // same update; the second targets an already-gone row only in the
        // sense that Prisma re-validates existence on write. Same "already
        // gone" 404 every other not-found path in this app returns.
        P2025: () => {
          throw new NotFoundException(
            `No se encontró la notificación con ID ${id}`,
          );
        },
      });
    }
  }

  // "Mark all read" from the dropdown. A no-op for anything already read,
  // so this is safe to call repeatedly (e.g. every time the dropdown opens).
  async markAllAsRead(userId: string) {
    await this.prisma.client.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { success: true };
  }
}
