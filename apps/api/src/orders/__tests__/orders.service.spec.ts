import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../../cart/cart.service';
import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../../users/role.enum';

describe('OrdersService', () => {
  let service: OrdersService;
  let prismaService: PrismaService;
  let cartService: CartService;

  const mockPrismaService = {
    client: {
      product: {
        findUnique: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
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
    prismaService = module.get<PrismaService>(PrismaService);
    cartService = module.get<CartService>(CartService);
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
          {
            id: 'item1',
            productId: 'product1',
            quantity: 2,
          },
          {
            id: 'item2',
            productId: 'product2',
            quantity: 1,
          },
        ],
      };

      const mockProduct1 = {
        id: 'product1',
        title: 'Product 1',
        isApproved: true,
        price: 10.0,
      };

      const mockProduct2 = {
        id: 'product2',
        title: 'Product 2',
        isApproved: true,
        price: 20.0,
      };

      const mockOrder = {
        id: 'order1',
        userId,
        totalAmount: 40.0, // 10*2 + 20*1
        status: 'PENDING',
        items: [
          {
            id: 'oi1',
            productId: 'product1',
            quantity: 2,
            price: 10.0,
          },
          {
            id: 'oi2',
            productId: 'product2',
            quantity: 1,
            price: 20.0,
          },
        ],
      };

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique
        .mockResolvedValueOnce(mockProduct1)
        .mockResolvedValueOnce(mockProduct2);
      mockPrismaService.client.order.create.mockResolvedValue(mockOrder);

      const result = await service.createOrder(userId);

      expect(mockCartService.getCart).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.client.order.create).toHaveBeenCalledWith({
        data: {
          userId,
          totalAmount: 40.0,
          status: 'PENDING',
          shippingAddress: {},
          items: {
            create: [
              {
                productId: 'product1',
                quantity: 2,
                price: 10.0,
              },
              {
                productId: 'product2',
                quantity: 1,
                price: 20.0,
              },
            ],
          },
        },
        include: {
          items: {
            include: {
              product: {
                // Note: images is a Json field and is returned by default
              },
            },
          },
        },
      });
      expect(mockCartService.clearCart).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockOrder);
    });

    it('should throw error if cart is empty', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
      };

      mockCartService.getCart.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId)).rejects.toThrow('Cart is empty');
    });

    it('should throw error if product no longer available', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
          },
        ],
      };

      // Product not found (null) - should throw error
      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(userId)).rejects.toThrow(
        'Product undefined is no longer available',
      );
    });

    it('should throw error if product not approved', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [
          {
            id: 'item1',
            productId: 'product1',
            quantity: 1,
          },
        ],
      };

      const mockProduct = {
        id: 'product1',
        title: 'Product 1',
        isApproved: false, // not approved
        price: 10.0,
      };

      mockCartService.getCart.mockResolvedValue(mockCart);
      mockPrismaService.client.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.createOrder(userId)).rejects.toThrow(
        'Product Product 1 is no longer available',
      );
    });
  });

  describe('getUserOrders', () => {
    it('should return orders for a user', async () => {
      const userId = 'user1';
      const mockOrders = [
        {
          id: 'order1',
          userId,
          totalAmount: 100.0,
          status: 'PENDING',
        },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getUserOrders(userId);

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                // Note: images is a Json field and is returned by default
              },
            },
          },
        },
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
        include: {
          items: {
            include: {
              product: {
                // Note: images is a Json field and is returned by default
              },
            },
          },
        },
      });
      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order not found', async () => {
      const orderId = 'nonexistent';
      const userId = 'user1';
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(service.getOrderById(orderId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if order does not belong to user', async () => {
      const orderId = 'order1';
      const userId = 'user1';
      const mockOrder = {
        id: orderId,
        userId: 'user2', // different user
      };

      mockPrismaService.client.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.getOrderById(orderId, userId)).rejects.toThrow(
        'Not authorized to access this order',
      );
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders for admin', async () => {
      const mockOrders = [
        {
          id: 'order1',
          userId: 'user1',
          totalAmount: 100.0,
        },
        {
          id: 'order2',
          userId: 'user2',
          totalAmount: 200.0,
        },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.getAllOrders();

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: {
                // Note: images is a Json field and is returned by default
              },
            },
          },
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
      const mockOrder = {
        id: orderId,
        status: OrderStatus.PAID,
      };

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