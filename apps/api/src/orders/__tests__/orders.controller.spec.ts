import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// `esModuleInterop` is off in apps/api, and @types/supertest uses `export =`,
// so the namespace import is the one that stays callable after compilation.
import * as request from 'supertest';
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { AuthRequest } from '../../../src/types/request.types';
import { OrderStatus } from '../order-status.enum';
import { CreateOrderDto } from '../dto/create-order.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';
import { Role } from '../../users/role.enum';

describe('OrdersController', () => {
  let controller: OrdersController;
  let ordersService: OrdersService;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
    getAllOrders: jest.fn(),
    getOrderStats: jest.fn(),
    updateOrderStatus: jest.fn(),
    cancelOwnOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    ordersService = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should call ordersService.createOrder with userId from request and the shipping address', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const body = {
        shippingAddress: {
          street: 'Calle 72 #10-34',
          city: 'Bogotá',
          state: 'Cundinamarca',
          zip: '110221',
          country: 'Colombia',
        },
      } as CreateOrderDto;

      const mockResult = {
        id: 'order1',
        userId,
        totalAmount: 100.0,
      };

      mockOrdersService.createOrder.mockResolvedValue(mockResult);

      const result = await controller.createOrder(mockReq, body);

      expect(ordersService.createOrder).toHaveBeenCalledWith(userId, body);
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
    it('should call ordersService.getOrderById with id, userId, and role from request', async () => {
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

      expect(ordersService.getOrderById).toHaveBeenCalledWith(
        orderId,
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });

    it("should pass the admin role through so an admin can open another user's order", async () => {
      const orderId = 'order1';
      const mockReq = {
        user: { id: 'admin1', email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;

      const mockResult = {
        id: orderId,
        userId: 'someoneElse',
        totalAmount: 100.0,
      };

      mockOrdersService.getOrderById.mockResolvedValue(mockResult);

      const result = await controller.getOrderById(mockReq, orderId);

      expect(ordersService.getOrderById).toHaveBeenCalledWith(
        orderId,
        'admin1',
        'ADMIN',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('cancelOrder', () => {
    it('should call ordersService.cancelOwnOrder with userId and id from request', async () => {
      const userId = 'user1';
      const orderId = 'order1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { id: orderId, status: 'CANCELLED' };
      mockOrdersService.cancelOwnOrder.mockResolvedValue(mockResult);

      const result = await controller.cancelOrder(mockReq, orderId);

      expect(ordersService.cancelOwnOrder).toHaveBeenCalledWith(
        userId,
        orderId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllOrders', () => {
    it('should call ordersService.getAllOrders with query', async () => {
      const query = { search: 'ana', page: '1', limit: '10' };
      const mockResult = {
        data: [{ id: 'order1', userId: 'user1', totalAmount: 100.0 }],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      };

      mockOrdersService.getAllOrders.mockResolvedValue(mockResult);

      const result = await controller.getAllOrders(query);

      expect(ordersService.getAllOrders).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getOrderStats', () => {
    it('should return the aggregate the service produced, untouched', async () => {
      const mockResult = {
        totalOrders: 1200,
        confirmedRevenue: 45000000,
        pendingRevenue: 1500000,
      };

      mockOrdersService.getOrderStats.mockResolvedValue(mockResult);

      const result = await controller.getOrderStats();

      expect(ordersService.getOrderStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('is admin-only, like the rest of the admin/* order routes', () => {
      const reflector = new Reflector();
      const requiredRoles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        OrdersController.prototype.getOrderStats,
        OrdersController,
      ]);

      expect(requiredRoles).toEqual([Role.ADMIN]);
    });
  });

  describe('updateOrderStatus', () => {
    it('should call ordersService.updateOrderStatus with id and status', async () => {
      const orderId = 'order1';
      const body: { status: OrderStatus } = { status: OrderStatus.PAID };
      const mockResult = {
        id: orderId,
        status: OrderStatus.PAID,
      };

      mockOrdersService.updateOrderStatus.mockResolvedValue(mockResult);

      const result = await controller.updateOrderStatus(orderId, body);

      expect(ordersService.updateOrderStatus).toHaveBeenCalledWith(
        orderId,
        OrderStatus.PAID,
      );
      expect(result).toEqual(mockResult);
    });
  });

  // Nest matches routes in declaration order and `@Get(':id')` is declared
  // before the admin routes, so assert against the real router that the literal
  // admin/* paths are not swallowed by the wildcard param.
  describe('route resolution', () => {
    let app: INestApplication;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [OrdersController],
        providers: [{ provide: OrdersService, useValue: mockOrdersService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

      app = module.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('routes GET /orders/admin/stats to getOrderStats, not to the :id handler', async () => {
      const stats = {
        totalOrders: 3,
        confirmedRevenue: 250000,
        pendingRevenue: 50000,
      };
      mockOrdersService.getOrderStats.mockResolvedValue(stats);

      const res = await request(app.getHttpServer())
        .get('/orders/admin/stats')
        .expect(200);

      expect(res.body).toEqual(stats);
      expect(mockOrdersService.getOrderStats).toHaveBeenCalledTimes(1);
      expect(mockOrdersService.getOrderById).not.toHaveBeenCalled();
    });

    it('still routes GET /orders/admin/all to getAllOrders', async () => {
      const page = {
        data: [],
        meta: { total: 0, page: 1, limit: 5, pages: 0 },
      };
      mockOrdersService.getAllOrders.mockResolvedValue(page);

      const res = await request(app.getHttpServer())
        .get('/orders/admin/all?limit=5')
        .expect(200);

      expect(res.body).toEqual(page);
      expect(mockOrdersService.getOrderById).not.toHaveBeenCalled();
    });
  });
});
