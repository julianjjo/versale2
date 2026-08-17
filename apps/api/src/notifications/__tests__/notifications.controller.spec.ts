import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { AuthRequest } from '../../types/request.types';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  const mockReq = {
    user: { id: 'user1', email: 'test@example.com', role: 'USER' },
  } as AuthRequest;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(
      NotificationsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it("should call notificationsService.findAll with the caller's userId and query", async () => {
      const query = { page: '2', unreadOnly: 'true' };
      const mockResult = {
        data: [{ id: 'notif1' }],
        meta: { total: 1, page: 2, limit: 10, pages: 1 },
      };
      mockNotificationsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockReq, query);

      expect(notificationsService.findAll).toHaveBeenCalledWith(
        'user1',
        query,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUnreadCount', () => {
    it("should call notificationsService.getUnreadCount with the caller's userId", async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue({ count: 3 });

      const result = await controller.getUnreadCount(mockReq);

      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith(
        'user1',
      );
      expect(result).toEqual({ count: 3 });
    });
  });

  describe('markAllAsRead', () => {
    it("should call notificationsService.markAllAsRead with the caller's userId", async () => {
      mockNotificationsService.markAllAsRead.mockResolvedValue({
        success: true,
      });

      const result = await controller.markAllAsRead(mockReq);

      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith(
        'user1',
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('markAsRead', () => {
    it("should call notificationsService.markAsRead with the caller's userId and the notification id", async () => {
      const mockResult = { id: 'notif1', read: true };
      mockNotificationsService.markAsRead.mockResolvedValue(mockResult);

      const result = await controller.markAsRead(mockReq, 'notif1');

      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        'user1',
        'notif1',
      );
      expect(result).toEqual(mockResult);
    });
  });
});
