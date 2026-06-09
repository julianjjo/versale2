import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../../cart/cart.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { OrderStatus } from '../order-status.enum';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockTx = {
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

  const mockCartService = {
    getCart: jest.fn(),
    clearCart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrder', () => {
    it('should create an order from cart', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          { id: 'item1', productId: 'product1', quantity: 2 },
          { id: 'item2', productId: 'product2', quantity: 1 },
        ],
      };

      const mockProduct1 = {
        id: 'product1',
        title: 'Product 1',
        isApproved: true,
        price: 10.0,
        sellerId: 'sellerA',
      };

      const mockProduct2 = {
        id: 'product2',
        title: 'Product 2',
        isApproved: true,
        price: 20.0,
        sellerId: 'sellerB',
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

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique
        .mockResolvedValueOnce(mockProduct1)
        .mockResolvedValueOnce(mockProduct2);
      mockTx.order.create.mockResolvedValue(mockOrder);
      mockTx.cartItem.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.createOrder(userId);

      expect(mockCartService.getCart).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledTimes(
        2,
      );
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

    it('should throw BadRequestException if cart is empty', async () => {
      const userId = 'user1';
      mockCartService.getCart.mockResolvedValue({
        id: 'cart1',
        userId,
        items: [],
      });

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if product no longer available', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [{ id: 'item1', productId: 'product1', quantity: 1 }],
      };

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if product not approved', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [{ id: 'item1', productId: 'product1', quantity: 1 }],
      };

      const mockProduct = {
        id: 'product1',
        title: 'Product 1',
        isApproved: false,
        price: 10.0,
        sellerId: 'sellerA',
      };

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(service.createOrder(userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if user tries to buy their own product', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [{ id: 'item1', productId: 'product1', quantity: 1 }],
      };

      const mockProduct = {
        id: 'product1',
        title: 'Product 1',
        isApproved: true,
        price: 10.0,
        sellerId: userId,
      };

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

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

      const result = await service.getOrderById(orderId, userId);

      expect(mockPrismaService.client.order.findUnique).toHaveBeenCalledWith({
        where: { id: orderId },
        include: { items: { include: { product: true } } },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderById('nonexistent', 'user1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order does not belong to user', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'user2',
      });

      await expect(service.getOrderById('order1', 'user1')).rejects.toThrow(
        ForbiddenException,
      );
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
