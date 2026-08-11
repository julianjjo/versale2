import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '../order-status.enum';
import { Role } from '../../users/role.enum';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const mockTx = {
    cart: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
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
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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
            quantity: 2,
            priceAtAdd: 10.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
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
              price: 20.0,
              sellerId: 'sellerB',
            },
          },
        ],
      };

      const mockOrder = {
        id: 'order1',
        userId,
        totalAmount: 40.0,
        status: 'PENDING',
        items: [
          { id: 'oi1', productId: 'product1', quantity: 2, price: 10.0 },
          { id: 'oi2', productId: 'product2', quantity: 1, price: 20.0 },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.createOrder(userId);

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
          totalAmount: 40.0,
          status: OrderStatus.PENDING,
          shippingAddress: {},
          items: {
            create: [
              { productId: 'product1', quantity: 2, price: 10.0 },
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

    it('should use the cart item priceAtAdd snapshot, not the live product price, for line price and total', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 2,
            priceAtAdd: 15.0,
            product: {
              id: 'product1',
              title: 'Product 1',
              isApproved: true,
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
        totalAmount: 30.0,
        status: 'PENDING',
        items: [{ id: 'oi1', productId: 'product1', quantity: 2, price: 15.0 }],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.createOrder(userId);

      expect(mockTx.order.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalAmount: 30.0,
          status: OrderStatus.PENDING,
          shippingAddress: {},
          items: {
            create: [{ productId: 'product1', quantity: 2, price: 15.0 }],
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

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the user has no cart at all', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
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
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
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
              price: 10.0,
              sellerId: userId,
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
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
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
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
    it('should return all orders for admin', async () => {
      const mockOrders = [
        { id: 'order1', userId: 'user1', totalAmount: 100.0 },
        { id: 'order2', userId: 'user2', totalAmount: 200.0 },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getAllOrders();

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockOrders);
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      const orderId = 'order1';
      const status: OrderStatus = OrderStatus.PAID;
      const mockOrder = { id: orderId, status: OrderStatus.PAID };

      mockPrismaService.client.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateOrderStatus(orderId, status);

      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { status },
      });
      expect(result).toEqual(mockOrder);
    });
  });
});
