import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { AuthRequest } from '../../../src/types/request.types';
import { OrderStatus } from '../order-status.enum';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
    getAllOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should call mockOrdersService.createOrder with userId from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: 'order1',
        userId,
        totalAmount: 100.0,
      };

      mockOrdersService.createOrder.mockResolvedValue(mockResult);

      const result = await controller.createOrder(mockReq, {});

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(userId, {});
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserOrders', () => {
    it('should call mockOrdersService.getUserOrders with userId from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = [
        {
          id: 'order1',
          userId,
          totalAmount: 100.0,
        },
      ];

      mockOrdersService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getUserOrders(mockReq);

      expect(mockOrdersService.getUserOrders).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getOrderById', () => {
    it('should call mockOrdersService.getOrderById with id and userId from request', async () => {
      const userId = 'user1';
      const orderId = 'order1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: orderId,
        userId,
        totalAmount: 100.0,
      };

      mockOrdersService.getOrderById.mockResolvedValue(mockResult);

      const result = await controller.getOrderById(mockReq, orderId);

      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(
        orderId,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllOrders', () => {
    it('should call mockOrdersService.getAllOrders', async () => {
      const mockResult = [
        {
          id: 'order1',
          userId: 'user1',
          totalAmount: 100.0,
        },
      ];

      mockOrdersService.getAllOrders.mockResolvedValue(mockResult);

      const result = await controller.getAllOrders();

      expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith();
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateOrderStatus', () => {
    it('should call mockOrdersService.updateOrderStatus with id and status', async () => {
      const orderId = 'order1';
      const body: { status: OrderStatus } = { status: OrderStatus.PAID };
      const mockResult = {
        id: orderId,
        status: OrderStatus.PAID,
      };

      mockOrdersService.updateOrderStatus.mockResolvedValue(mockResult);

      const result = await controller.updateOrderStatus(orderId, body);

      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.PAID,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
