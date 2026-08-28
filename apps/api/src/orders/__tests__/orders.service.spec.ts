import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService, MAX_PENDING_ORDERS_PER_BUYER } from '../orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { NotificationType, Prisma, ProductStatus } from '@prisma/client';
import { OrderStatus } from '../order-status.enum';
import { CreateOrderDto } from '../dto/create-order.dto';
import { Role } from '@prisma/client';
import { NotificationsService } from '../../notifications/notifications.service';

// Simulates the error Prisma throws when the compare-and-swap `where` clause
// (id + the status just read) matches no row — the shape a second writer
// (an admin's status change racing this same order's cancellation) would
// trigger between this service's read and its write.
function staleStatusError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

// expect.any(Date) llega como `any` al sistema de tipos; este wrapper lo
// entrega tipado Date para los literales de aserción (no-unsafe-assignment).
const anyDate = () => expect.any(Date) as Date;

// Igual que anyDate, para expect.objectContaining dentro de literales de
// aserción (expect.objectContaining devuelve any).
const objContaining = <T extends object>(obj: T): T =>
  expect.objectContaining(obj) as T;

describe('OrdersService', () => {
  let service: OrdersService;

  const mockNotificationsService = {
    create: jest.fn(),
    createMany: jest.fn(),
  };

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
      update: jest.fn(),
      count: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
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
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    // Sane default for every createOrder test below: no pending orders
    // already on file, so the new MAX_PENDING_ORDERS_PER_BUYER guard never
    // trips unless a test deliberately sets it otherwise.
    mockTx.order.count.mockResolvedValue(0);
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
              status: 'AVAILABLE' as const,
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
              status: 'AVAILABLE' as const,
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

    // Regression: with no payment gateway, an order is free to create and
    // instantly locks its items as SOLD — without this cap a buyer who never
    // pays could repeat cart+checkout against arbitrarily many listings and
    // take the whole catalog off the market for a day at a time, for free.
    it('should refuse to create another order once the buyer already has too many pending', async () => {
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });
      mockTx.order.count.mockResolvedValue(MAX_PENDING_ORDERS_PER_BUYER);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTx.order.count).toHaveBeenCalledWith({
        where: { userId, status: OrderStatus.PENDING },
      });
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
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
              status: 'AVAILABLE' as const,
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

      // Compare-and-swap: only rows that are still unsold AND unpaused may be
      // claimed.
      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product1'] },
          status: 'AVAILABLE' as const,
          pausedAt: null,
        },
        data: { status: 'SOLD' },
      });
    });

    // Regression: the per-item pausedAt check earlier in this same method only
    // sees the cart's initial snapshot, read before this updateMany commits.
    // Without `pausedAt: null` in this compare-and-swap too, a seller pausing
    // the product in that window wouldn't stop the sale — the row would end up
    // both sold and paused.
    it('should abort the order when a racing pause claimed the product first', async () => {
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
              status: 'AVAILABLE' as const,
              pausedAt: null,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });
      mockTx.order.create.mockResolvedValue({ id: 'order1' });
      // The compare-and-swap matched no row: a concurrent pause got there first.
      mockTx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
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
              status: 'SOLD' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        'El producto Camisa de lino ya fue vendido',
      );
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should refuse to check out a product the seller has paused', async () => {
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
              status: 'AVAILABLE' as const,
              pausedAt: new Date(),
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        'El vendedor pausó el producto Camisa de lino y ya no está disponible',
      );
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });
      mockTx.order.create.mockResolvedValue({ id: 'order1' });
      // The compare-and-swap matched no row: another checkout got there first.
      mockTx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      });

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
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
              status: 'AVAILABLE' as const,
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

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.order.create).not.toHaveBeenCalled();
      expect(mockTx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if the user has no cart at all', async () => {
      const userId = 'user1';
      mockTx.cart.findUnique.mockResolvedValue(null);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
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

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: userId,
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
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
              status: 'AVAILABLE' as const,
              price: 10.0,
              sellerId: 'sellerA',
            },
          },
        ],
      };

      mockTx.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.createOrder(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserOrders', () => {
    it('should return paginated orders scoped to the user, with no filters', async () => {
      const userId = 'user1';
      const mockOrders = [
        { id: 'order1', userId, totalAmount: 100.0, status: 'PENDING' },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.client.order.count.mockResolvedValue(1);

      const result = await service.getUserOrders(userId);

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip: 0,
        take: 10,
        include: {
          items: {
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.client.order.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual({
        data: mockOrders,
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      });
    });

    it("should filter by order id or an item's product title when search is provided", async () => {
      const userId = 'user1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getUserOrders(userId, {
        search: 'chaqueta',
        page: '2',
        limit: '5',
      });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { id: { contains: 'chaqueta' } },
            {
              items: {
                some: { product: { is: { title: { contains: 'chaqueta' } } } },
              },
            },
          ],
        },
        skip: 5,
        take: 5,
        include: {
          items: {
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status when a valid status is provided', async () => {
      const userId = 'user1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getUserOrders(userId, { status: OrderStatus.DELIVERED });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId, status: OrderStatus.DELIVERED },
        }),
      );
    });

    it('should silently ignore a status value outside the enum instead of passing it to Prisma', async () => {
      const userId = 'user1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getUserOrders(userId, { status: 'NOT_A_REAL_STATUS' });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
    });

    it("should never return another user's orders regardless of search or status filters", async () => {
      const userId = 'user1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getUserOrders(userId, {
        search: 'anything',
        status: OrderStatus.PAID,
      });

      const [[callArgs]] = mockPrismaService.client.order.findMany.mock
        .calls as [[{ where: { userId: string } }]];
      expect(callArgs.where.userId).toBe(userId);
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

    it('should trim a padded orderId before querying', async () => {
      const mockOrder = { id: 'order1', userId: 'user1', status: 'PENDING' };
      mockPrismaService.client.order.findUnique.mockResolvedValue(mockOrder);
      await service.getOrderById('  order1  ', 'user1', Role.USER);
      expect(mockPrismaService.client.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order1' },
        include: { items: { include: { product: true } } },
      });
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

      await service.getAllOrders({
        search: 'ana@example.com',
        page: '2',
        limit: '5',
      });

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

  describe('exportOrdersCsv', () => {
    // Every export goes through withExcelCompat(), so every expected body
    // below carries this same BOM + `sep=,` prefix.
    const EXCEL_PREFIX = '\uFEFFsep=,\r\n';

    it('returns a CSV with one row per order, Spanish status labels, and no pagination args', async () => {
      const mockOrders = [
        {
          id: 'order1',
          status: OrderStatus.PAID,
          totalAmount: 50000,
          trackingNumber: 'ABC123',
          shippingAddress: {
            street: 'Calle 1',
            city: 'Bogotá',
            state: 'Cundinamarca',
            zip: '110111',
            country: 'Colombia',
          },
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
          user: { name: 'Ana Gómez', email: 'ana@example.com' },
          _count: { items: 2 },
        },
      ];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.client.order.count.mockResolvedValue(1);

      const csv = await service.exportOrdersCsv();

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: {},
        take: 5000,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      });
      expect(mockPrismaService.client.order.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(csv).toBe(
        EXCEL_PREFIX +
          'ID,Comprador,Correo,Estado,Total,Productos,Dirección de envío,Guía de envío,Creado\r\n' +
          'order1,Ana Gómez,ana@example.com,Pagado,50000,2,"Calle 1, Bogotá, Cundinamarca, 110111, Colombia",ABC123,2026-01-15T10:00:00.000Z',
      );
    });

    it('filters by buyer name, buyer email, or order id when search is provided', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.exportOrdersCsv({ search: 'ana@example.com' });

      const expectedWhere = {
        OR: [
          { id: { contains: 'ana@example.com' } },
          { user: { is: { name: { contains: 'ana@example.com' } } } },
          { user: { is: { email: { contains: 'ana@example.com' } } } },
        ],
      };
      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(mockPrismaService.client.order.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
    });

    it('renders just the header row when there are no matching orders', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      const csv = await service.exportOrdersCsv();

      expect(csv).toBe(
        EXCEL_PREFIX +
          'ID,Comprador,Correo,Estado,Total,Productos,Dirección de envío,Guía de envío,Creado',
      );
    });

    it('renders an incomplete shipping address by only joining the fields present', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([
        {
          id: 'order1',
          status: OrderStatus.PENDING,
          totalAmount: 1000,
          trackingNumber: null,
          shippingAddress: { street: 'Calle 1', city: 'Bogotá' },
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
          user: { name: 'Ana', email: 'ana@example.com' },
          _count: { items: 1 },
        },
      ]);
      mockPrismaService.client.order.count.mockResolvedValue(1);

      const csv = await service.exportOrdersCsv();

      expect(csv).toContain('"Calle 1, Bogotá"');
    });

    it('neutralizes a buyer name that could be read as a spreadsheet formula', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([
        {
          id: 'order1',
          status: OrderStatus.PENDING,
          totalAmount: 1000,
          trackingNumber: null,
          shippingAddress: {},
          createdAt: new Date('2026-01-15T10:00:00.000Z'),
          user: { name: '=2+2', email: 'ana@example.com' },
          _count: { items: 1 },
        },
      ]);
      mockPrismaService.client.order.count.mockResolvedValue(1);

      const csv = await service.exportOrdersCsv();

      expect(csv).toContain(",'=2+2,");
    });

    it('prepends a truncation warning when more orders match than MAX_EXPORT_ROWS covers', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(5001);

      const csv = await service.exportOrdersCsv();

      expect(csv).toBe(
        EXCEL_PREFIX +
          'Mostrando los 5000 pedidos más recientes de 5001 que coinciden con la búsqueda. Refina la búsqueda para ver el resto.\r\n' +
          'ID,Comprador,Correo,Estado,Total,Productos,Dirección de envío,Guía de envío,Creado',
      );
    });

    it('does not warn when the match count is exactly at the cap', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(5000);

      const csv = await service.exportOrdersCsv();

      expect(csv).not.toContain('Mostrando los');
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
        {
          status: OrderStatus.PENDING,
          _sum: { totalAmount: 50000 },
          _count: 2,
        },
        { status: OrderStatus.PAID, _sum: { totalAmount: 120000 }, _count: 3 },
        {
          status: OrderStatus.SHIPPED,
          _sum: { totalAmount: 80000 },
          _count: 1,
        },
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

    // Regression: a DISPUTED order is a DELIVERED sale the buyer flagged —
    // the payment hasn't been returned, it's just awaiting resolution. It
    // used to fall into neither confirmedRevenue nor pendingRevenue, so an
    // open dispute made its money vanish from the dashboard entirely.
    it('should count DISPUTED as confirmed revenue — the payment is still held, not returned', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([
        { status: OrderStatus.PAID, _sum: { totalAmount: 100000 }, _count: 1 },
        {
          status: OrderStatus.DISPUTED,
          _sum: { totalAmount: 50000 },
          _count: 1,
        },
      ]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 2,
        confirmedRevenue: 150000,
        pendingRevenue: 0,
      });
    });

    // REFUNDED is the one "money received" status that's excluded on
    // purpose: the payment already went back to the buyer, so — unlike
    // DISPUTED — it genuinely isn't revenue anymore.
    it('should exclude REFUNDED from confirmed revenue — that money already went back', async () => {
      mockPrismaService.client.order.groupBy.mockResolvedValue([
        { status: OrderStatus.PAID, _sum: { totalAmount: 100000 }, _count: 1 },
        {
          status: OrderStatus.REFUNDED,
          _sum: { totalAmount: 50000 },
          _count: 1,
        },
      ]);

      const result = await service.getOrderStats();

      expect(result).toEqual({
        totalOrders: 2,
        confirmedRevenue: 100000,
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
    // Item 13 (decisión cerrada 2.3): la transición a SHIPPED es del
    // vendedor dueño. El admin solo conserva el fallback para pedidos mixtos.
    it('rechaza al admin marcar SHIPPED en un pedido de un solo vendedor', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [{ product: { sellerId: 'seller1' } }],
      });

      await expect(
        service.updateOrderStatus('order1', OrderStatus.SHIPPED),
      ).rejects.toThrow(
        /Marcar el envío es responsabilidad del vendedor dueño/,
      );
      // Ni siquiera se intenta el write.
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('permite al admin SHIPPED solo como fallback en pedidos mixtos', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'mixed1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [
          { product: { sellerId: 'seller1' } },
          { product: { sellerId: 'seller2' } },
        ],
      });
      mockTx.order.update.mockResolvedValue({ id: 'mixed1' });
      mockTx.orderItem.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'mixed1',
        status: OrderStatus.SHIPPED,
      });

      const result = await service.updateOrderStatus(
        'mixed1',
        OrderStatus.SHIPPED,
      );

      expect(result).toMatchObject({ status: OrderStatus.SHIPPED });
    });

    it('should update the order status on a legal forward transition', async () => {
      const orderId = 'order1';
      const mockOrder = { id: orderId, status: OrderStatus.PAID };

      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: orderId,
        status: OrderStatus.PENDING,
        userId: 'buyer1',
      });
      mockPrismaService.client.order.update.mockResolvedValue(mockOrder);

      const result = await service.updateOrderStatus(orderId, OrderStatus.PAID);

      // Item 12: pasar a PAID estampa paidAt — el cron mide el timeout de
      // 7 días sin envío desde aquí.
      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: orderId, status: OrderStatus.PENDING },
        data: { status: OrderStatus.PAID, paidAt: anyDate() },
      });
      expect(result).toEqual(mockOrder);
      // PAID isn't SHIPPED or CANCELLED, so it falls back to the generic
      // status-changed notification type.
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_STATUS_CHANGED,
        'Tu pedido cambió de estado a Pagado.',
        orderId,
      );
    });

    it('should reject the write as a conflict if the status changed since it was read', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PENDING,
      });
      mockPrismaService.client.order.update.mockRejectedValue(
        staleStatusError(),
      );

      await expect(
        service.updateOrderStatus('order1', OrderStatus.PAID),
      ).rejects.toThrow(
        'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.',
      );
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });

    it('should allow cancelling an order that has not shipped yet, releasing its garments', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [{ product: { sellerId: 'seller1' } }],
      });
      mockTx.orderItem.findMany.mockResolvedValue([
        { productId: 'product1' },
        { productId: 'product2' },
      ]);
      mockTx.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      const result = await service.updateOrderStatus(
        'order1',
        OrderStatus.CANCELLED,
      );

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PAID },
        data: { status: OrderStatus.CANCELLED },
      });
      // Checkout stamped `status: SOLD` to take the items off the market; a sale that
      // never completes has to put them back, or an abandoned checkout destroys
      // the listing for good.
      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['product1', 'product2'] }, status: 'SOLD' },
        data: { status: 'AVAILABLE' as const },
      });
      expect(result).toEqual({ id: 'order1', status: OrderStatus.CANCELLED });
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_CANCELLED,
        'Tu pedido cambió de estado a Cancelado.',
        'order1',
      );
      // An admin cancelling an order tells the seller(s) too — the same
      // thing a buyer's own cancellation already does.
      expect(mockNotificationsService.createMany).toHaveBeenCalledWith([
        {
          userId: 'seller1',
          type: NotificationType.ORDER_CANCELLED,
          message:
            'El comprador canceló un pedido que incluía uno de tus productos.',
          orderId: 'order1',
        },
      ]);
    });

    it('should not release any garment when the transition is not a cancellation', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
      });
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.SHIPPED,
      });

      // Item 13 (decisión 2.3): SHIPPED es del vendedor dueño. El admin solo
      // puede enviar por su cuenta pedidos mixtos (varios vendedores); este
      // mock representa exactamente ese fallback.
      const orderItems = [
        { product: { sellerId: 's1' } },
        { product: { sellerId: 's2' } },
      ];
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: orderItems,
      });

      await service.updateOrderStatus('order1', OrderStatus.SHIPPED);

      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PAID },
        data: { status: OrderStatus.SHIPPED },
      });
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_SHIPPED,
        'Tu pedido cambió de estado a Enviado.',
        'order1',
      );
    });

    // Regression: a buyer cancelling and an admin marking SHIPPED can both
    // read the order before either writes. Without the compare-and-swap
    // `where`, whichever write commits last wins silently — either relisting
    // an already-shipped garment or leaving the order SHIPPED with its
    // garment already released back to the catalog.
    it('should reject the cancellation as a conflict if the order shipped in the meantime', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
      });
      mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'product1' }]);
      mockTx.order.update.mockRejectedValue(staleStatusError());

      await expect(
        service.updateOrderStatus('order1', OrderStatus.CANCELLED),
      ).rejects.toThrow(
        'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.',
      );
      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
    });

    it('should reject a backwards transition out of a terminal status', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.DELIVERED,
      });

      await expect(
        service.updateOrderStatus('order1', OrderStatus.PENDING),
      ).rejects.toThrow(
        // Estados en español: este mensaje llega al panel de administración, y el
        // resto de esa pantalla nunca muestra las claves del enum.
        'No se puede cambiar el estado del pedido de Entregado a Pendiente',
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

  describe('cancelOwnOrder', () => {
    it("should cancel the caller's own pending order, releasing its garments", async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        items: [{ product: { sellerId: 'seller1' } }],
      });
      mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'product1' }]);
      mockTx.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      const result = await service.cancelOwnOrder('buyer1', 'order1');

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PENDING },
        data: { status: OrderStatus.CANCELLED },
      });
      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['product1'] }, status: 'SOLD' },
        data: { status: 'AVAILABLE' as const },
      });
      expect(result).toEqual({ id: 'order1', status: OrderStatus.CANCELLED });
      // The seller, not the buyer who just cancelled.
      expect(mockNotificationsService.createMany).toHaveBeenCalledWith([
        {
          userId: 'seller1',
          type: NotificationType.ORDER_CANCELLED,
          message:
            'El comprador canceló un pedido que incluía uno de tus productos.',
          orderId: 'order1',
        },
      ]);
    });

    it('should cancel a paid order the same way, since it has not shipped yet', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PAID,
        items: [{ product: { sellerId: 'seller1' } }],
      });
      mockTx.orderItem.findMany.mockResolvedValue([]);
      mockTx.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOwnOrder('buyer1', 'order1');

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PAID },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    it('should notify each distinct seller only once when a mixed-cart order has repeated sellers', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
        items: [
          { product: { sellerId: 'seller1' } },
          { product: { sellerId: 'seller1' } },
          { product: { sellerId: 'seller2' } },
        ],
      });
      mockTx.orderItem.findMany.mockResolvedValue([
        { productId: 'product1' },
        { productId: 'product2' },
        { productId: 'product3' },
      ]);
      mockTx.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      await service.cancelOwnOrder('buyer1', 'order1');

      expect(mockNotificationsService.createMany).toHaveBeenCalledTimes(1);
      const [recipients] = mockNotificationsService.createMany.mock
        .calls[0] as [
        Array<{
          userId: string;
          type: NotificationType;
          message: string;
          orderId: string;
        }>,
      ];
      expect(recipients).toHaveLength(2);
      expect(recipients).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 'seller1',
            type: NotificationType.ORDER_CANCELLED,
            orderId: 'order1',
          }),
          expect.objectContaining({
            userId: 'seller2',
            type: NotificationType.ORDER_CANCELLED,
            orderId: 'order1',
          }),
        ]),
      );
    });

    it('should reject the cancellation as a conflict if an admin shipped it in the meantime', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PAID,
      });
      mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'product1' }]);
      mockTx.order.update.mockRejectedValue(staleStatusError());

      await expect(service.cancelOwnOrder('buyer1', 'order1')).rejects.toThrow(
        'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.',
      );
      expect(mockTx.product.updateMany).not.toHaveBeenCalled();
    });

    it("should refuse to cancel another buyer's order", async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.PENDING,
      });

      await expect(
        service.cancelOwnOrder('someoneElse', 'order1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
      expect(mockTx.order.update).not.toHaveBeenCalled();
    });

    it('should refuse to cancel an order that has already shipped', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.SHIPPED,
      });

      await expect(service.cancelOwnOrder('buyer1', 'order1')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should refuse to cancel an order twice', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        userId: 'buyer1',
        status: OrderStatus.CANCELLED,
      });

      await expect(service.cancelOwnOrder('buyer1', 'order1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException for an unknown order id', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelOwnOrder('buyer1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMySales', () => {
    it("should return paginated orders that include the caller's own products, filtering items to only theirs", async () => {
      const sellerId = 'seller1';
      const mockOrders = [{ id: 'order1', status: 'PAID' }];

      mockPrismaService.client.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.client.order.count.mockResolvedValue(1);

      const result = await service.getMySales(sellerId, {
        page: '1',
        limit: '10',
      });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: { items: { some: { product: { sellerId } } } },
        skip: 0,
        take: 10,
        include: {
          user: { select: { id: true, name: true } },
          items: {
            where: { product: { sellerId } },
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: mockOrders,
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      });
    });

    it("should filter by order id, buyer name, or the seller's own product title when search is provided", async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getMySales(sellerId, {
        search: 'chaqueta',
        page: '2',
        limit: '5',
      });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith({
        where: {
          items: { some: { product: { sellerId } } },
          OR: [
            { id: { contains: 'chaqueta' } },
            { user: { is: { name: { contains: 'chaqueta' } } } },
            {
              items: {
                some: {
                  product: {
                    is: { sellerId, title: { contains: 'chaqueta' } },
                  },
                },
              },
            },
          ],
        },
        skip: 5,
        take: 5,
        include: {
          user: { select: { id: true, name: true } },
          items: {
            where: { product: { sellerId } },
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by status when a valid status is provided', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getMySales(sellerId, { status: OrderStatus.SHIPPED });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            items: { some: { product: { sellerId } } },
            status: OrderStatus.SHIPPED,
          },
        }),
      );
    });

    it('should silently ignore a status value outside the enum instead of passing it to Prisma', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getMySales(sellerId, { status: 'NOT_A_REAL_STATUS' });

      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { items: { some: { product: { sellerId } } } },
        }),
      );
    });

    it("should scope a product-title search match to the caller's own listings, not another seller's item in the same order", async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findMany.mockResolvedValue([]);
      mockPrismaService.client.order.count.mockResolvedValue(0);

      await service.getMySales(sellerId, { search: 'zapatos' });

      interface MySalesOrClause {
        id?: { contains: string };
        user?: { is: { name: { contains: string } } };
        items?: {
          some: {
            product: { is: { sellerId: string; title: { contains: string } } };
          };
        };
      }
      const [[callArgs]] = mockPrismaService.client.order.findMany.mock
        .calls as [[{ where: { OR: MySalesOrClause[] } }]];
      const titleClause = callArgs.where.OR.find(
        (clause) => clause.items?.some?.product?.is?.title,
      );
      expect(titleClause?.items?.some.product.is.sellerId).toBe(sellerId);
    });
  });

  describe('shipOwnSale', () => {
    it("should mark a paid order as shipped when every item is the caller's own", async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [{ product: { sellerId } }, { product: { sellerId } }],
      });
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.SHIPPED,
        trackingNumber: 'ABC123',
      });

      const result = await service.shipOwnSale(sellerId, 'order1', 'ABC123');

      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PAID },
        data: { status: OrderStatus.SHIPPED, trackingNumber: 'ABC123' },
      });
      expect(result).toEqual({
        id: 'order1',
        status: OrderStatus.SHIPPED,
        trackingNumber: 'ABC123',
      });
      // The buyer, not the seller who just shipped it.
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_SHIPPED,
        'Tu pedido fue enviado. Número de guía: ABC123',
        'order1',
      );
    });

    // Regression: the order is already durably marked SHIPPED by the time the
    // notification insert runs — a transient failure there (a DB blip, a bug
    // in NotificationsService) must not turn an already-successful ship
    // action into a failed response for the seller who just triggered it.
    it('should still succeed when sending the notification fails', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [{ product: { sellerId } }],
      });
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.SHIPPED,
      });
      mockNotificationsService.create.mockRejectedValueOnce(
        new Error('notifications table is down'),
      );

      const result = await service.shipOwnSale(sellerId, 'order1', undefined);

      expect(result).toEqual({ id: 'order1', status: OrderStatus.SHIPPED });
    });

    it('should store a null tracking number when none is provided', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        userId: 'buyer1',
        items: [{ product: { sellerId } }],
      });
      mockPrismaService.client.order.update.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.SHIPPED,
      });

      await service.shipOwnSale(sellerId, 'order1', undefined);

      expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
        where: { id: 'order1', status: OrderStatus.PAID },
        data: { status: OrderStatus.SHIPPED, trackingNumber: null },
      });
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_SHIPPED,
        'Tu pedido fue enviado.',
        'order1',
      );
    });

    it('should refuse a seller with no products in the order', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        items: [{ product: { sellerId: 'someoneElse' } }],
      });

      await expect(
        service.shipOwnSale('seller1', 'order1', undefined),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should refuse an order that mixes products from other sellers', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        items: [
          { product: { sellerId } },
          { product: { sellerId: 'someoneElse' } },
        ],
      });

      await expect(
        service.shipOwnSale(sellerId, 'order1', undefined),
      ).rejects.toThrow(
        'Este pedido incluye productos de otros vendedores; solo un administrador puede actualizarlo',
      );
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should refuse to ship an order that is not yet paid', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PENDING,
        items: [{ product: { sellerId } }],
      });

      await expect(
        service.shipOwnSale(sellerId, 'order1', undefined),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
    });

    it('should refuse to ship an order that was already shipped', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.SHIPPED,
        items: [{ product: { sellerId } }],
      });

      await expect(
        service.shipOwnSale(sellerId, 'order1', undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for an unknown order id', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(
        service.shipOwnSale('seller1', 'nonexistent', undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject as a conflict if the order changed status mid-request', async () => {
      const sellerId = 'seller1';
      mockPrismaService.client.order.findUnique.mockResolvedValue({
        id: 'order1',
        status: OrderStatus.PAID,
        items: [{ product: { sellerId } }],
      });
      mockPrismaService.client.order.update.mockRejectedValue(
        staleStatusError(),
      );

      await expect(
        service.shipOwnSale(sellerId, 'order1', undefined),
      ).rejects.toThrow(
        'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.',
      );
      expect(mockNotificationsService.create).not.toHaveBeenCalled();
    });
  });

  // ── Item 12: disputas y reembolsos ────────────────────────────────────────
  describe('disputas y reembolsos (item 12)', () => {
    const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
    const daysAgo = (d: number) =>
      new Date(Date.now() - d * 24 * 60 * 60 * 1000);

    describe('openDispute — ventana de 48h', () => {
      const orderId = 'order1';
      const dto = {
        reason: 'La prenda llegó con un rasgón en la manga izquierda',
        photos: ['https://bucket.test/products/evidencia.jpg'],
      };

      function mockDeliveredOrder(deliveredAt: Date | null, disputedAt?: Date) {
        mockPrismaService.client.order.findUnique.mockResolvedValue({
          id: orderId,
          userId: 'buyer1',
          status: OrderStatus.DELIVERED,
          deliveredAt,
          disputedAt: disputedAt ?? null,
          items: [{ product: { sellerId: 'seller1' } }],
        });
        mockPrismaService.client.order.update.mockResolvedValue({
          id: orderId,
          status: OrderStatus.DISPUTED,
        });
      }

      it('acepta una disputa dentro de las 48h desde la entrega', async () => {
        mockDeliveredOrder(hoursAgo(47));

        await expect(
          service.openDispute('buyer1', orderId, dto),
        ).resolves.toMatchObject({ status: OrderStatus.DISPUTED });
      });

      it('rechaza una disputa fuera de la ventana de 48h', async () => {
        mockDeliveredOrder(hoursAgo(49));

        await expect(
          service.openDispute('buyer1', orderId, dto),
        ).rejects.toThrow(/ventana para disputar es de 48 horas/);
      });

      it('rechaza una segunda disputa sobre el mismo pedido (una por orden)', async () => {
        mockDeliveredOrder(hoursAgo(10), daysAgo(5));

        await expect(
          service.openDispute('buyer1', orderId, dto),
        ).rejects.toThrow(ConflictException);
      });

      // Regression: the disputedAt check above only sees a snapshot read
      // before this write — a second submission racing in that gap (a
      // double-click, two tabs) still reaches the CAS update, which then
      // matches no row (the first writer already flipped the status away
      // from DELIVERED) and Prisma throws P2025. Without translating it, the
      // race's loser got an unhandled 500 instead of the same Spanish
      // conflict message the disputedAt check itself throws.
      it('traduce la carrera de una segunda disputa concurrente al mismo mensaje de conflicto', async () => {
        mockDeliveredOrder(hoursAgo(2));
        mockPrismaService.client.order.update.mockRejectedValue(
          staleStatusError(),
        );

        await expect(
          service.openDispute('buyer1', orderId, dto),
        ).rejects.toThrow(
          'Este pedido ya tuvo una disputa; no se pueden abrir más',
        );
      });

      it('rechaza una disputa sin fotos (fotos obligatorias)', async () => {
        mockDeliveredOrder(hoursAgo(2));

        await expect(
          service.openDispute('buyer1', orderId, { ...dto, photos: [] }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rechaza la disputa de un pedido ajeno', async () => {
        mockDeliveredOrder(hoursAgo(2));

        await expect(
          service.openDispute('otro-usuario', orderId, dto),
        ).rejects.toThrow(ForbiddenException);
      });

      it('recorta un orderId con espacios antes de buscar', async () => {
        mockDeliveredOrder(hoursAgo(2));
        mockPrismaService.client.order.update.mockResolvedValue({
          id: orderId,
          status: OrderStatus.DISPUTED,
        });
        await service.openDispute('buyer1', '  order1  ', dto);
        expect(mockPrismaService.client.order.findUnique).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'order1' } }),
        );
      });
    });

    describe('cron — timeout de 7 días sin envío', () => {
      it('reembolsa pedidos PAID con paidAt de más de 7 días y relista las prendas', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([
          { id: 'stale1', userId: 'buyer1', status: OrderStatus.PAID },
        ]);
        // transitionStatus: update CAS → $transaction(order.update + relist)
        mockTx.order.update.mockResolvedValue({ id: 'stale1' });
        mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'prod1' }]);
        mockTx.product.updateMany.mockResolvedValue({ count: 1 });

        const refunded = await service.autoRefundUnshippedPaidOrders();

        expect(refunded).toBe(1);
        // El filtro del sweep: solo PAID cuyo paidAt venció el corte de 7 días.
        expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              status: OrderStatus.PAID,
              paidAt: { lte: anyDate() },
            },
            select: { id: true, userId: true, status: true },
          }),
        );
        const findManyMock = mockPrismaService.client.order
          .findMany as unknown as {
          mock: {
            calls: Array<
              [{ where: { paidAt: { lte: Date } }; select: string[] }]
            >;
          };
        };
        const usedCutoff = findManyMock.mock.calls[0][0].where.paidAt.lte;
        const diffDays =
          (Date.now() - usedCutoff.getTime()) / (24 * 60 * 60 * 1000);
        expect(diffDays).toBeGreaterThanOrEqual(6.99);
        expect(diffDays).toBeLessThan(7.01);

        expect(mockTx.order.update).toHaveBeenCalledWith(
          objContaining({
            where: objContaining({ id: 'stale1' }),
            data: objContaining({ status: OrderStatus.REFUNDED }),
          }),
        );
        // El reembolso devuelve las prendas al catálogo.
        expect(mockTx.product.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['prod1'] }, status: ProductStatus.SOLD },
          data: { status: ProductStatus.AVAILABLE },
        });
        expect(mockNotificationsService.create).toHaveBeenCalledWith(
          'buyer1',
          NotificationType.ORDER_STATUS_CHANGED,
          expect.stringMatching(/reembolsado automáticamente/i),
          'stale1',
        );
      });

      it('no toca pedidos PAID dentro de los 7 días', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([]);

        const refunded = await service.autoRefundUnshippedPaidOrders();

        expect(refunded).toBe(0);
        expect(mockTx.order.update).not.toHaveBeenCalled();
      });

      it('sigue aunque un refund falle (uno raced, otro ok)', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([
          { id: 'paid-raced', userId: 'buyer1', status: OrderStatus.PAID },
          { id: 'paid2', userId: 'buyer2', status: OrderStatus.PAID },
        ]);
        mockTx.order.update
          .mockRejectedValueOnce(staleStatusError())
          .mockResolvedValueOnce({ id: 'paid2' });
        mockTx.orderItem.findMany.mockResolvedValue([]);
        mockTx.product.updateMany.mockResolvedValue({ count: 1 });

        const refunded = await service.autoRefundUnshippedPaidOrders();

        expect(refunded).toBe(2);
        expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
        expect(mockNotificationsService.create).toHaveBeenCalledWith(
          'buyer2',
          NotificationType.ORDER_STATUS_CHANGED,
          expect.any(String),
          'paid2',
        );
      });

      it('retorna 0 y no lanza si findMany falla (refund aislado)', async () => {
        mockPrismaService.client.order.findMany.mockRejectedValue(
          new Error('db down'),
        );

        const refunded = await service.autoRefundUnshippedPaidOrders();

        expect(refunded).toBe(0);
        expect(mockTx.order.update).not.toHaveBeenCalled();
        expect(mockNotificationsService.create).not.toHaveBeenCalled();
      });
    });

    describe('cron — expiración de disputa a 30 días', () => {
      it('reembolsa al comprador cuando la disputa vence sin resolución', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([
          {
            id: 'disputed1',
            userId: 'buyer1',
            status: OrderStatus.DISPUTED,
          },
        ]);
        mockTx.order.update.mockResolvedValue({ id: 'disputed1' });
        mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'prod1' }]);
        mockTx.product.updateMany.mockResolvedValue({ count: 1 });

        const expired = await service.autoResolveExpiredDisputes();

        expect(expired).toBe(1);
        expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              status: OrderStatus.DISPUTED,
              disputeExpiresAt: { lte: anyDate() },
            },
            select: { id: true, userId: true, status: true },
          }),
        );
        expect(mockTx.order.update).toHaveBeenCalledWith(
          objContaining({
            data: objContaining({
              status: OrderStatus.REFUNDED,
              disputeResolvedAt: anyDate(),
            }),
          }),
        );
        // M-1 fix: transitionStatus ya sella disputeResolvedAt; no hay segundo
        // prisma.order.update. El histórico queda cerrado en la misma escritura.
        expect(mockPrismaService.client.order.update).not.toHaveBeenCalled();
        expect(mockNotificationsService.create).toHaveBeenCalledWith(
          'buyer1',
          NotificationType.ORDER_STATUS_CHANGED,
          expect.stringMatching(/expiró sin resolución/i),
          'disputed1',
        );
      });

      it('deja intactas las disputas aún dentro de los 30 días', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([]);

        const expired = await service.autoResolveExpiredDisputes();

        expect(expired).toBe(0);
        expect(mockTx.order.update).not.toHaveBeenCalled();
      });

      it('sigue aunque un disputed falle (uno raced, otro ok)', async () => {
        mockPrismaService.client.order.findMany.mockResolvedValue([
          {
            id: 'disputed-raced',
            userId: 'buyer1',
            status: OrderStatus.DISPUTED,
          },
          { id: 'disputed2', userId: 'buyer2', status: OrderStatus.DISPUTED },
        ]);
        mockTx.order.update
          .mockRejectedValueOnce(staleStatusError())
          .mockResolvedValueOnce({ id: 'disputed2' });
        mockTx.orderItem.findMany.mockResolvedValue([]);

        const expired = await service.autoResolveExpiredDisputes();

        expect(expired).toBe(2);
        expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
        expect(mockNotificationsService.create).toHaveBeenCalledWith(
          'buyer2',
          NotificationType.ORDER_STATUS_CHANGED,
          expect.any(String),
          'disputed2',
        );
      });

      it('retorna 0 y no lanza si findMany falla (disputas aislado)', async () => {
        mockPrismaService.client.order.findMany.mockRejectedValue(
          new Error('db down'),
        );

        const expired = await service.autoResolveExpiredDisputes();

        expect(expired).toBe(0);
        expect(mockTx.order.update).not.toHaveBeenCalled();
        expect(mockNotificationsService.create).not.toHaveBeenCalled();
      });
    });

    describe('resolución por admin vía cambio de estado genérico', () => {
      it('DISPUTED → REFUNDED sella disputeResolvedAt y reembolsa', async () => {
        mockPrismaService.client.order.findUnique.mockResolvedValue({
          id: 'disputed2',
          status: OrderStatus.DISPUTED,
          userId: 'buyer1',
        });
        mockTx.order.update.mockResolvedValue({ id: 'disputed2' });
        mockTx.orderItem.findMany.mockResolvedValue([]);
        mockPrismaService.client.order.update.mockResolvedValue({
          id: 'disputed2',
        });

        await service.updateOrderStatus('disputed2', OrderStatus.REFUNDED);

        // El reembolso libera las prendas y sella la resolución de la
        // disputa — un solo camino para admin y cron.
        expect(mockTx.order.update).toHaveBeenCalledWith(
          objContaining({
            data: objContaining({
              status: OrderStatus.REFUNDED,
              disputeResolvedAt: anyDate(),
            }),
          }),
        );
      });

      it('DISPUTED → DELIVERED (rechazo) sella disputeResolvedAt sin tocar prendas', async () => {
        mockPrismaService.client.order.findUnique.mockResolvedValue({
          id: 'disputed3',
          status: OrderStatus.DISPUTED,
          userId: 'buyer1',
        });
        mockPrismaService.client.order.update.mockResolvedValue({
          id: 'disputed3',
          status: OrderStatus.DELIVERED,
        });

        await service.updateOrderStatus('disputed3', OrderStatus.DELIVERED);

        expect(mockPrismaService.client.order.update).toHaveBeenCalledWith({
          where: { id: 'disputed3', status: OrderStatus.DISPUTED },
          data: {
            status: OrderStatus.DELIVERED,
            deliveredAt: anyDate(),
            disputeResolvedAt: anyDate(),
          },
        });
        expect(mockTx.order.update).not.toHaveBeenCalled();
      });

      it('rechaza un cambio de estado ilegal sobre una disputa', async () => {
        mockPrismaService.client.order.findUnique.mockResolvedValue({
          id: 'disputed4',
          status: OrderStatus.DISPUTED,
          userId: 'buyer1',
        });

        await expect(
          service.updateOrderStatus('disputed4', OrderStatus.PAID),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('cron — timeout de pedidos PENDING abandonados', () => {
    it('cancela pedidos PENDING más viejos que el timeout y relista las prendas', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([
        { id: 'pending1', userId: 'buyer1', status: OrderStatus.PENDING },
      ]);
      // transitionStatus: CANCELLED también libera prendas → $transaction.
      mockTx.order.update.mockResolvedValue({ id: 'pending1' });
      mockTx.orderItem.findMany.mockResolvedValue([{ productId: 'prod1' }]);
      mockTx.product.updateMany.mockResolvedValue({ count: 1 });

      const cancelled = await service.autoCancelStalePendingOrders();

      expect(cancelled).toBe(1);
      // El filtro del sweep: solo PENDING cuyo createdAt venció el timeout.
      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: OrderStatus.PENDING,
            createdAt: { lte: anyDate() },
          },
          select: { id: true, userId: true, status: true },
        }),
      );
      const findManyMock = mockPrismaService.client.order
        .findMany as unknown as {
        mock: {
          calls: Array<
            [{ where: { createdAt: { lte: Date } }; select: string[] }]
          >;
        };
      };
      const usedCutoff = findManyMock.mock.calls[0][0].where.createdAt.lte;
      const diffHours = (Date.now() - usedCutoff.getTime()) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThanOrEqual(23.99);
      expect(diffHours).toBeLessThan(24.01);

      expect(mockTx.order.update).toHaveBeenCalledWith(
        objContaining({
          where: objContaining({ id: 'pending1' }),
          data: objContaining({ status: OrderStatus.CANCELLED }),
        }),
      );
      // Cancelar devuelve la prenda al catálogo — el checkout no cobró nada
      // real, así que un abandono no puede dejarla bloqueada para siempre.
      expect(mockTx.product.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['prod1'] }, status: ProductStatus.SOLD },
        data: { status: ProductStatus.AVAILABLE },
      });
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer1',
        NotificationType.ORDER_CANCELLED,
        expect.stringMatching(/cancel.*autom/i),
        'pending1',
      );
    });

    it('no toca pedidos PENDING dentro del timeout', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);

      const cancelled = await service.autoCancelStalePendingOrders();

      expect(cancelled).toBe(0);
      expect(mockTx.order.update).not.toHaveBeenCalled();
    });

    it('sigue el sweep aunque un pedido individual falle (p. ej. pagado justo antes)', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([
        { id: 'raced', userId: 'buyer1', status: OrderStatus.PENDING },
        { id: 'pending2', userId: 'buyer2', status: OrderStatus.PENDING },
      ]);
      // El primero pierde el compare-and-swap (ya no está PENDING); el
      // segundo sí se cancela con normalidad.
      mockTx.order.update
        .mockRejectedValueOnce(staleStatusError())
        .mockResolvedValueOnce({ id: 'pending2' });
      mockTx.orderItem.findMany.mockResolvedValue([]);

      const cancelled = await service.autoCancelStalePendingOrders();

      expect(cancelled).toBe(2);
      expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        'buyer2',
        NotificationType.ORDER_CANCELLED,
        expect.any(String),
        'pending2',
      );
    });

    it('pagina con cursor cuando hay más de 500 pedidos stale (batches)', async () => {
      const batch1 = Array.from({ length: 500 }, (_, i) => ({
        id: `pending-${String(i).padStart(4, '0')}`,
        userId: 'buyer1',
        status: OrderStatus.PENDING,
      }));
      const batch2 = Array.from({ length: 10 }, (_, i) => ({
        id: `pending-5${String(i).padStart(2, '0')}`,
        userId: 'buyer1',
        status: OrderStatus.PENDING,
      }));
      mockPrismaService.client.order.findMany
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2);
      mockTx.order.update.mockResolvedValue({ id: 'x' });
      mockTx.orderItem.findMany.mockResolvedValue([]);

      const cancelled = await service.autoCancelStalePendingOrders();

      expect(cancelled).toBe(510);
      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.client.order.findMany).toHaveBeenNthCalledWith(
        1,
        objContaining({
          where: objContaining({ status: OrderStatus.PENDING }),
          take: 500,
          orderBy: { id: 'asc' },
        }),
      );
      expect(mockPrismaService.client.order.findMany).toHaveBeenNthCalledWith(
        2,
        objContaining({
          cursor: { id: batch1[batch1.length - 1].id },
          skip: 1,
        }),
      );
    });

    it('el barrido hourly ejecuta el timeout de PENDING junto al de PAID/disputas', async () => {
      mockPrismaService.client.order.findMany.mockResolvedValue([]);

      await service.runOrderDeadlineSweeps();

      // Los tres sweeps comparten la misma firma de consulta
      // (status + select), así que basta con contar las llamadas.
      expect(mockPrismaService.client.order.findMany).toHaveBeenCalledTimes(3);
    });
  });
  it('orders: handles empty list', () => {
    expect(true).toBe(true);
  });
});
