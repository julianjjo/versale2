import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';

// Simulates the error Prisma throws when `update`'s `where` matches no row —
// the shape a second markAsRead call on the same notification would trigger.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockPrismaService = {
    client: {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a notification with the given userId, type, message, and orderId', async () => {
      const mockNotification = {
        id: 'notif1',
        userId: 'user1',
        type: NotificationType.ORDER_SHIPPED,
        message: 'Tu pedido fue enviado.',
        orderId: 'order1',
        read: false,
      };
      mockPrismaService.client.notification.create.mockResolvedValue(
        mockNotification,
      );

      const result = await service.create(
        'user1',
        NotificationType.ORDER_SHIPPED,
        'Tu pedido fue enviado.',
        'order1',
      );

      expect(mockPrismaService.client.notification.create).toHaveBeenCalledWith(
        {
          data: {
            userId: 'user1',
            type: NotificationType.ORDER_SHIPPED,
            message: 'Tu pedido fue enviado.',
            orderId: 'order1',
          },
        },
      );
      expect(result).toEqual(mockNotification);
    });

    it('creates a notification without an orderId when none is given', async () => {
      mockPrismaService.client.notification.create.mockResolvedValue({});

      await service.create(
        'user1',
        NotificationType.ORDER_STATUS_CHANGED,
        'Algo pasó.',
      );

      expect(mockPrismaService.client.notification.create).toHaveBeenCalledWith(
        {
          data: {
            userId: 'user1',
            type: NotificationType.ORDER_STATUS_CHANGED,
            message: 'Algo pasó.',
            orderId: undefined,
          },
        },
      );
    });
  });

  describe('findAll', () => {
    it("should return the user's notifications newest-first, paginated", async () => {
      const userId = 'user1';
      const mockNotifications = [{ id: 'notif1', userId }];
      mockPrismaService.client.notification.findMany.mockResolvedValue(
        mockNotifications,
      );
      mockPrismaService.client.notification.count.mockResolvedValue(1);

      const result = await service.findAll(userId, { page: '1', limit: '10' });

      expect(mockPrismaService.client.notification.findMany).toHaveBeenCalledWith(
        {
          where: { userId },
          skip: 0,
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      );
      expect(result).toEqual({
        data: mockNotifications,
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      });
    });

    it('should narrow to unread only when unreadOnly is set', async () => {
      const userId = 'user1';
      mockPrismaService.client.notification.findMany.mockResolvedValue([]);
      mockPrismaService.client.notification.count.mockResolvedValue(0);

      await service.findAll(userId, { unreadOnly: 'true' });

      expect(mockPrismaService.client.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, read: false } }),
      );
      expect(mockPrismaService.client.notification.count).toHaveBeenCalledWith({
        where: { userId, read: false },
      });
    });

    it('should never return another user notifications regardless of query', async () => {
      mockPrismaService.client.notification.findMany.mockResolvedValue([]);
      mockPrismaService.client.notification.count.mockResolvedValue(0);

      await service.findAll('user1', {});

      expect(mockPrismaService.client.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user1' } }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should count only this user\'s unread notifications', async () => {
      mockPrismaService.client.notification.count.mockResolvedValue(4);

      const result = await service.getUnreadCount('user1');

      expect(mockPrismaService.client.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user1', read: false },
      });
      expect(result).toEqual({ count: 4 });
    });
  });

  describe('markAsRead', () => {
    it("should mark the caller's own notification as read", async () => {
      mockPrismaService.client.notification.findUnique.mockResolvedValue({
        id: 'notif1',
        userId: 'user1',
      });
      const updated = { id: 'notif1', userId: 'user1', read: true };
      mockPrismaService.client.notification.update.mockResolvedValue(updated);

      const result = await service.markAsRead('user1', 'notif1');

      expect(mockPrismaService.client.notification.update).toHaveBeenCalledWith(
        {
          where: { id: 'notif1' },
          data: { read: true },
        },
      );
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException for an unknown notification id', async () => {
      mockPrismaService.client.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.markAsRead('user1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.notification.update).not.toHaveBeenCalled();
    });

    it("should refuse to mark another user's notification as read", async () => {
      mockPrismaService.client.notification.findUnique.mockResolvedValue({
        id: 'notif1',
        userId: 'someoneElse',
      });

      await expect(
        service.markAsRead('user1', 'notif1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.notification.update).not.toHaveBeenCalled();
    });

    it('should surface a 404 if the notification is deleted mid-request', async () => {
      mockPrismaService.client.notification.findUnique.mockResolvedValue({
        id: 'notif1',
        userId: 'user1',
      });
      mockPrismaService.client.notification.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.markAsRead('user1', 'notif1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllAsRead', () => {
    it("should mark every one of the caller's unread notifications as read", async () => {
      mockPrismaService.client.notification.updateMany.mockResolvedValue({
        count: 3,
      });

      const result = await service.markAllAsRead('user1');

      expect(mockPrismaService.client.notification.updateMany).toHaveBeenCalledWith(
        {
          where: { userId: 'user1', read: false },
          data: { read: true },
        },
      );
      expect(result).toEqual({ success: true });
    });
  });
});
