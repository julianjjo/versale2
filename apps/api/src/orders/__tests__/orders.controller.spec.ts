import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { AuthRequest } from '../../../src/types/request.types';
import { OrderStatus } from '../../users/role.enum';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: OrdersService;

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
      providers: [
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should call ordersService.createOrder with userId from request', async () => {
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

      const result = await controller.createOrder(mockReq);

      expect(ordersService.createOrder).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserOrders', () => {
    it('should call ordersService.getUserOrders with userId from request', async () => {
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

      expect(ordersService.getUserOrders).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getOrderById', () => {
    it('should call ordersService.getOrderById with id and userId from request', async () => {
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

      expect(ordersService.getOrderById).toHaveBeenCalledWith(orderId, userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllOrders', () => {
    it('should call ordersService.getAllOrders', async () => {
      const mockResult = [
        {
          id: 'order1',
          userId: 'user1',
          totalAmount: 100.0,
        },
      ];

      mockOrdersService.getAllOrders.mockResolvedValue(mockResult);

      const result = await controller.getAllOrders();

      expect(ordersService.getAllOrders).toHaveBeenCalledWith();
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateOrderStatus', () => {
    it('should call ordersService.updateOrderStatus with id and status', async () => {
      const orderId = 'order1';
      const status = 'PAID';
      const body = { status };
      const mockResult = {
        id: orderId,
        status: OrderStatus.PAID,
      };

      mockOrdersService.updateOrderStatus.mockResolvedValue(mockResult);

      const result = await controller.updateOrderStatus(orderId, body);

      expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(orderId, OrderStatus.PAID);
      expect(result).toEqual(mockResult);
    });
  });
});