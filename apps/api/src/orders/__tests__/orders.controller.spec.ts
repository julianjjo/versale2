import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
// `esModuleInterop` is off in apps/api, and @types/supertest uses `export =`.
// The namespace-star form (`import * as request`) stays callable at runtime
// but type-aware ESLint fails to resolve its type through that form, so the
// `import = require()` form is used instead — it resolves correctly for both
// runtime and lint, at the cost of needing one narrow rule exception below.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');
import { OrdersController } from '../orders.controller';
import { OrdersService } from '../orders.service';
import { AuthRequest } from '../../../src/types/request.types';
import { OrderStatus } from '../order-status.enum';
import { CreateOrderDto } from '../dto/create-order.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { ROLES_KEY } from '../../auth/roles.decorator';
import { Role } from '@prisma/client';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
    getAllOrders: jest.fn(),
    exportOrdersCsv: jest.fn(),
    getOrderStats: jest.fn(),
    updateOrderStatus: jest.fn(),
    cancelOwnOrder: jest.fn(),
    getMySales: jest.fn(),
    shipOwnSale: jest.fn(),
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

      expect(mockOrdersService.createOrder).toHaveBeenCalledWith(userId, body);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUserOrders', () => {
    it('should call ordersService.getUserOrders with userId from request and the query', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const query = {
        search: 'chaqueta',
        status: 'PAID',
        page: '1',
        limit: '10',
      };

      const mockResult = {
        data: [{ id: 'order1', userId, totalAmount: 100.0 }],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      };

      mockOrdersService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getUserOrders(mockReq, query);

      expect(mockOrdersService.getUserOrders).toHaveBeenCalledWith(
        userId,
        query,
      );
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

      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(
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

      expect(mockOrdersService.getOrderById).toHaveBeenCalledWith(
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

      expect(mockOrdersService.cancelOwnOrder).toHaveBeenCalledWith(
        userId,
        orderId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getMySales', () => {
    it('should call ordersService.getMySales with userId from request and query', async () => {
      const userId = 'seller1';
      const mockReq = {
        user: { id: userId, email: 'seller@example.com', role: 'USER' },
      } as AuthRequest;
      const query = { page: '1', limit: '10' };

      const mockResult = {
        data: [{ id: 'order1', status: 'PAID' }],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      };
      mockOrdersService.getMySales.mockResolvedValue(mockResult);

      const result = await controller.getMySales(mockReq, query);

      expect(mockOrdersService.getMySales).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('shipOwnSale', () => {
    it('should call ordersService.shipOwnSale with userId, id and the tracking number', async () => {
      const userId = 'seller1';
      const orderId = 'order1';
      const mockReq = {
        user: { id: userId, email: 'seller@example.com', role: 'USER' },
      } as AuthRequest;
      const body = { trackingNumber: 'ABC123' };

      const mockResult = {
        id: orderId,
        status: OrderStatus.SHIPPED,
        trackingNumber: 'ABC123',
      };
      mockOrdersService.shipOwnSale.mockResolvedValue(mockResult);

      const result = await controller.shipOwnSale(mockReq, orderId, body);

      expect(mockOrdersService.shipOwnSale).toHaveBeenCalledWith(
        userId,
        orderId,
        'ABC123',
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

      expect(mockOrdersService.getAllOrders).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('exportOrders', () => {
    it('should call ordersService.exportOrdersCsv with query and return the CSV body', async () => {
      const query = { search: 'ana' };
      const csv = 'ID,Comprador\r\norder1,Ana';

      mockOrdersService.exportOrdersCsv.mockResolvedValue(csv);

      const result = await controller.exportOrders(query);

      expect(mockOrdersService.exportOrdersCsv).toHaveBeenCalledWith(query);
      expect(result).toBe(csv);
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

      expect(mockOrdersService.getOrderStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResult);
    });

    it('is admin-only, like the rest of the admin/* order routes', () => {
      const reflector = new Reflector();
      const requiredRoles = reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        // The method reference is only used as a decorator-metadata lookup
        // key here, never invoked, so there's no unbound-`this` risk.
        // eslint-disable-next-line @typescript-eslint/unbound-method
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

      expect(mockOrdersService.updateOrderStatus).toHaveBeenCalledWith(
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
        .useValue({
          // The real guard populates `request.user` from the JWT; routes
          // below that read `req.user.id` (getMySales, shipOwnSale) need a
          // stand-in so they don't crash on `undefined.id`.
          canActivate: (context: ExecutionContext) => {
            const req = context.switchToHttp().getRequest<AuthRequest>();
            req.user = {
              id: 'seller1',
              email: 'seller@example.com',
              role: 'USER',
            };
            return true;
          },
        })
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

      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
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

      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/orders/admin/all?limit=5')
        .expect(200);

      expect(res.body).toEqual(page);
      expect(mockOrdersService.getOrderById).not.toHaveBeenCalled();
    });

    it('routes GET /orders/mine/sales to getMySales, not to the :id handler', async () => {
      const page = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      };
      mockOrdersService.getMySales.mockResolvedValue(page);

      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .get('/orders/mine/sales')
        .expect(200);

      expect(res.body).toEqual(page);
      expect(mockOrdersService.getOrderById).not.toHaveBeenCalled();
    });

    it('routes PATCH /orders/mine/sales/:id/ship to shipOwnSale, not to the :id/cancel handler', async () => {
      const result = { id: 'order1', status: 'SHIPPED' };
      mockOrdersService.shipOwnSale.mockResolvedValue(result);

      const res = await request(
        app.getHttpServer() as unknown as Parameters<typeof request>[0],
      )
        .patch('/orders/mine/sales/order1/ship')
        .send({ trackingNumber: 'ABC123' })
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockOrdersService.cancelOwnOrder).not.toHaveBeenCalled();
    });
  });
});
