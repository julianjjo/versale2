import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from '../cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';

describe('CartService', () => {
  let service: CartService;
  let prismaService: PrismaService;
  let productsService: ProductsService;

  const mockPrismaService = {
    client: {
      cart: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      cartItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prismaService = module.get<PrismaService>(PrismaService);
    productsService = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should return existing cart if found', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(mockPrismaService.client.cart.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  seller: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockCart);
    });

    it('should create a new cart if none exists', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.cart.findUnique.mockResolvedValue(null);
      mockPrismaService.client.cart.create.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(mockPrismaService.client.cart.create).toHaveBeenCalledWith({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  seller: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockCart);
    });
  });

  describe('addItem', () => {
    it('should add a new item to cart', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 2;

      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
      };

      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.create.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 2,
        priceAtAdd: 10.0,
      });

      const result = await service.addItem(userId, productId, quantity);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.create).toHaveBeenCalledWith({
        data: {
          cartId: 'cart1',
          productId,
          quantity: 2,
          priceAtAdd: 10.0,
        },
        include: {
          product: {
            include: {
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    it('should throw error if product not approved', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 2;

      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
      };

      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: false, // Not approved
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      await expect(service.addItem(userId, productId, quantity)).rejects.toThrow(
        'Product is not approved for sale',
      );
    });

    it('should update quantity if item already exists', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 2;

      const existingItem = {
        id: 'item1',
        productId,
        quantity: 1,
      };

      const mockCart = {
        id: 'cart1',
        userId,
        items: [existingItem],
      };

      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.update.mockResolvedValue({
        id: 'item1',
        quantity: 3, // 1 + 2
      });

      const result = await service.addItem(userId, productId, quantity);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'item1' },
        data: { quantity: 3 },
        include: {
          product: {
            include: {
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });
    });
  });

  describe('updateItem', () => {
    it('should update cart item quantity', async () => {
      const cartItemId = 'item1';
      const quantity = 5;
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1',
        cart: { id: 'cart1' },
      });

      await service.updateItem(cartItemId, quantity, userId);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: cartItemId },
          data: { quantity },
          include: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException if cart item not found', async () => {
      const cartItemId = 'item1';
      const quantity = 5;
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem(cartItemId, quantity, userId),
      ).rejects.toThrow(/Cart item with ID .* not found/);
    });

    it('should throw error if cart item belongs to another user', async () => {
      const cartItemId = 'item1';
      const quantity = 5;
      const userId = 'user1';

      const mockCart = {
        id: 'cart2', // different cart id
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1', // item belongs to cart1
        cart: { id: 'cart1' },
      });

      await expect(
        service.updateItem(cartItemId, quantity, userId),
      ).rejects.toThrow('Not authorized to update this cart item');
    });
  });

  describe('removeItem', () => {
    it('should remove cart item', async () => {
      const cartItemId = 'item1';
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1',
        cart: { id: 'cart1' },
      });

      await service.removeItem(cartItemId, userId);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.cartItem.delete).toHaveBeenCalledWith({
        where: { id: cartItemId },
      });
    });

    it('should throw NotFoundException if cart item not found', async () => {
      const cartItemId = 'item1';
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.removeItem(cartItemId, userId),
      ).rejects.toThrow(/Cart item with ID .* not found/);
    });

    it('should throw error if cart item belongs to another user', async () => {
      const cartItemId = 'item1';
      const userId = 'user1';

      const mockCart = {
        id: 'cart2', // different cart id
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1', // item belongs to cart1
        cart: { id: 'cart1' },
      });

      await expect(
        service.removeItem(cartItemId, userId),
      ).rejects.toThrow('Not authorized to remove this cart item');
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);

      await service.clearCart(userId);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart1' },
      });
    });
  });
});
