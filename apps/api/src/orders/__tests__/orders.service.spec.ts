import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '../order-status.enum';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Role } from '../../users/role.enum';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const shippingAddress = {
    street: 'Calle 72 #10-34',
    city: 'Bogotá',
    state: 'Cundinamarca',
    zip: '110221',
    country: 'Colombia',
  };
  const createOrderDto = { shippingAddress } as CreateOrderDto;

  const mockTx = {
    cart: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
  };

  const mockPrismaService = {
    client: {
      $transaction: jest.fn((fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
      product: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      cartItem: {
        deleteMany: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order from cart, doing the entire read-validate-write inside a single transaction', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
          {
            id: 'item2',
            productId: 'product2',
            quantity: 1,
            priceAtAdd: 20.0,
            product: {
              id: 'product2',
              title: 'Product 2',
              isApproved: true,
              soldAt: null,
              price: 20.0,
              sellerId: 'sellerB',
            },
          },
        ],
      };

      const mockOrder = {
        id: 'order1',
        userId,
        totalAmount: 30.0,
        status: 'PENDING',
        items: [
          { id: 'oi1', productId: 'product1', quantity: 1, price: 10.0 },
          { id: 'oi2', productId: 'product2', quantity: 1, price: 20.0 },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.product.updateMany.mockResolvedValue({ count: 2 });
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.createOrder(userId, createOrderDto);

      // The whole read-validate-write sequence must happen inside one transaction,
      // reading the cart via tx (not via CartService or a separate prisma call),
      // and must not fall back to per-item product lookups (no N+1).
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.cart.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: { items: { include: { product: true } } },
      });
      expect(
        mockPrismaService.client.product.findUnique,
      ).not.toHaveBeenCalled();

      expect(mockTx.order.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalAmount: 30.0,
          status: OrderStatus.PENDING,
          shippingAddress,
          items: {
            create: [
              { productId: 'product1', quantity: 1, price: 10.0 },
              { productId: 'product2', quantity: 1, price: 20.0 },
            ],
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });
      expect(mockTx.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart1' },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should mark every purchased product as sold inside the same transaction', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });
      mockTx.order.create.mockResolvedValue({ id: 'order1' });
      mockTx.product.updateMany.mockResolvedValue({ count: 1 });
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      await service.createOrder(userId, createOrderDto);

      // Compare-and-swap: only rows that are still unsold may be claimed.
      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['product1'] }, soldAt: null },
        data: { soldAt: expect.any(Date) },
      });
    });

    it('should refuse to check out a product that is already sold', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Camisa de lino',
              isApproved: true,
              soldAt: new Date(),
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow('El producto Camisa de lino ya fue vendido');
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should abort the order when a racing checkout claimed the product first', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });
      mockTx.order.create.mockResolvedValue({ id: 'order1' });
      // The compare-and-swap matched no row: another checkout got there first.
      mockTx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
      // The throw rolls the transaction back, so the cart is never emptied.
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should refuse an order claiming more units than exist of a one-of-a-kind product', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 5,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockTx.order.create).not.toHaveBeenCalled();
    });

    it('should use the cart item priceAtAdd snapshot, not the live product price, for line price and total', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 15.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              // Seller raised the price after the buyer added it to their cart.
              price: 999.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      const mockOrder = {
        id: 'order1',
        userId,
        totalAmount: 15.0,
        status: 'PENDING',
        items: [{ id: 'oi1', productId: 'product1', quantity: 1, price: 15.0 }],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.product.updateMany.mockResolvedValue({ count: 1 });
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.createOrder(userId, createOrderDto);

      expect(mockTx.order.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalAmount: 15.0,
          status: OrderStatus.PENDING,
          shippingAddress,
          items: {
            create: [{ productId: 'product1', quantity: 1, price: 15.0 }],
          },
        },
        include: {
          items: { include: { product: true } },
        },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw BadRequestException if cart has no items, inside the transaction', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [],
      });

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the user has no cart at all', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue(null);

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if the product on a cart item is missing', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: null,
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if product not approved', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: false,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user tries to buy their own product', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: userId,
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for an invalid (non-positive) quantity', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 0,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
              soldAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(
        service.createOrder(userId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getUserOrders', () => {
    it('should return orders for a user', async () => {
      const userId = 'user1';
      const mockOrders = [
        { id: 'order1', userId, totalAmount: 100.0, status: 'PENDING' },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getUserOrders(userId);

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockOrders);
    });
  });

  describe('getOrderById', () => {
    it('should return an order if it belongs to the user', async () => {
      const orderId = 'order1';
      const userId = 'user1';
      const mockOrder = {
        id: orderId,
        userId,
        totalAmount: 100.0,
        status: 'PENDING',
      };

      mockPrismaService.client.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById(orderId, userId, Role.USER);

      expect(mockPrismaService.client.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById('nonexistent', 'user1', Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order does not belong to user and requester is not an admin', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'user2',
      });

      await expect(
        service.getOrderById('order1', 'user1', Role.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow an admin to access an order that does not belong to them', async () => {
      const mockOrder = {
        id: 'order1',
        userId: 'user2',
        totalAmount: 100.0,
        status: 'PENDING',
      };

      mockPrismaService.client.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderById('order1', 'admin1', Role.ADMIN);

      expect(result).toEqual(mockOrder);
    });
  });

  describe('getAllOrders', () => {
    it('should return paginated orders for admin with no search filter', async () => {
      const mockOrders = [
        { id: 'order1', userId: 'user1', totalAmount: 100.0 },
        { id: 'order2', userId: 'user2', totalAmount: 200.0 },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.client.order.count.mockResolvedValue(2);

      const result = await service.getAllOrders();

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.client.order.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({
        data: mockOrders,
        meta: { total: 2, page: 1, limit: 10, pages: 1 },
      });
    });

    it('should filter by buyer name, buyer email, or order id when search is provided', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getAllOrders({ search: 'ana@example.com', page: '2', limit: '5' });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: { contains: 'ana@example.com' } },
            { user: { is: { name: { contains: 'ana@example.com' } } } },
            { user: { is: { email: { contains: 'ana@example.com' } } } },
          ],
        },
        skip: 5,
        take: 5,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should clamp an out-of-range page and limit and report the sanitized values in meta', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      const result = await service.getAllOrders({ page: '-3', limit: '5000' });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 100,
        pages: 0,
      });
    });
  });

  describe('getOrderStats', () => {
    it('should aggregate in the database with groupBy instead of loading orders into JS', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([]);

      await service.getOrderStats();

      expect(mockPrismaService.client.order.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        _sum: { totalAmount: true },
        _count: true,
      });
      // No page of orders is fetched just to add up a column.
      expect(mockPrismaService.client.order.findMany).not.toHaveBeenCalled();
    });

    it('should count PAID, SHIPPED and DELIVERED as confirmed revenue and PENDING as pending', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([
        { status: OrderStatus.PENDING, _sum: { totalAmount: 50000 }, _count: 2 },
        { status: OrderStatus.PAID, _sum: { totalAmount: 120000 }, _count: 3 },
        { status: OrderStatus.SHIPPED, _sum: { totalAmount: 80000 }, _count: 1 },
        {
          status: OrderStatus.DELIVERED,
          _sum: { totalAmount: 200000 },
          _count: 4,
        },
      ]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 10,
        confirmedRevenue: 400000,
        pendingRevenue: 50000,
      });
    });

    it('should exclude CANCELLED from both revenue figures while still counting the orders', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([
        { status: OrderStatus.PAID, _sum: { totalAmount: 120000 }, _count: 1 },
        {
          status: OrderStatus.CANCELLED,
          _sum: { totalAmount: 999000 },
          _count: 5,
        },
      ]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 6,
        confirmedRevenue: 120000,
        pendingRevenue: 0,
      });
    });

    it('should coalesce a null _sum.totalAmount to 0 instead of producing NaN', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([
        { status: OrderStatus.PAID, _sum: { totalAmount: null }, _count: 1 },
        { status: OrderStatus.PENDING, _sum: { totalAmount: null }, _count: 2 },
      ]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 3,
        confirmedRevenue: 0,
        pendingRevenue: 0,
      });
    });

    it('should report zeroes when there are no orders at all', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 0,
        confirmedRevenue: 0,
        pendingRevenue: 0,
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('should update the order status on a legal forward transition', async () => {
      const orderId = 'order1';
      const mockOrder = { id: orderId, status: OrderStatus.PAID };

      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: orderId,
        status: OrderStatus.PENDING,
      });
      mockPrismaService.client.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateOrderStatus(orderId, OrderStatus.PAID);

      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should allow cancelling an order that has not shipped yet', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
      });
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      await service.updateOrderStatus('order1', OrderStatus.CANCELLED);

      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: 'order1' },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    it('should reject a backwards transition out of a terminal status', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.DELIVERED,
      });

      await expect(
        service.updateOrderStatus('order1', OrderStatus.PENDING),
      ).rejects.toThrow(
        'No se puede cambiar el estado del pedido de DELIVERED a PENDING',
      );
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should reject reviving a cancelled order', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      await expect(
        service.updateOrderStatus('order1', OrderStatus.PAID),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should reject skipping a step in the lifecycle', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.updateOrderStatus('order1', OrderStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for an unknown order id', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateOrderStatus('nonexistent', OrderStatus.PAID),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });
  });
});
