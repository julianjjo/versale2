import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
        upsert: jest.fn(),
      },
      cartItem: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findOne: jest.fn(),
    findRaw: jest.fn(),
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
    it('should return existing cart via a single atomic upsert', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.cart.upsert.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(mockPrismaService.client.cart.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: {},
        create: { userId },
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

    it('should create a new cart via upsert if none exists', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.client.cart.upsert.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(mockPrismaService.client.cart.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: {},
        create: { userId },
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

    it('should resolve concurrent first-time getCart calls to a single cart with no unhandled unique-constraint error', async () => {
      const userId = 'user1';
      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
      };

      // Simulate the DB-level behavior of an atomic upsert: regardless of
      // how many times it races against another call for the same userId,
      // it always resolves to the same single row instead of throwing on
      // Cart.userId's @unique constraint.
      mockPrismaService.client.cart.upsert.mockResolvedValue(mockCart);

      const [first, second] = await Promise.all([
        service.getCart(userId),
        service.getCart(userId),
      ]);

      expect(mockPrismaService.client.cart.upsert).toHaveBeenCalledTimes(2);
      expect(first).toEqual(mockCart);
      expect(second).toEqual(mockCart);
    });
  });

  describe('addItem', () => {
    it('should upsert a new item into the cart', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 1;

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
        soldAt: null,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findRaw.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.upsert.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 1,
        priceAtAdd: 10.0,
      });

      const result = await service.addItem(userId, productId, quantity);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findRaw).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart1', productId } },
        update: { quantity: 1, priceAtAdd: 10.0 },
        create: {
          cartId: 'cart1',
          productId,
          quantity: 1,
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
      expect(result).toEqual({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 1,
        priceAtAdd: 10.0,
      });
    });

    it('should refuse to add a product that has already been sold', async () => {
      const userId = 'user1';
      const productId = 'product1';

      jest
        .spyOn(service, 'getCart')
        .mockResolvedValue({ id: 'cart1', userId, items: [] } as any);
      mockProductsService.findRaw.mockResolvedValue({
        id: productId,
        title: 'Test Product',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
        soldAt: new Date(),
      });

      await expect(service.addItem(userId, productId, 1)).rejects.toThrow(
        'Este producto ya fue vendido y no está disponible',
      );
      await expect(service.addItem(userId, productId, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('should refuse to add a product the seller has paused', async () => {
      const userId = 'user1';
      const productId = 'product1';

      jest
        .spyOn(service, 'getCart')
        .mockResolvedValue({ id: 'cart1', userId, items: [] } as any);
      mockProductsService.findRaw.mockResolvedValue({
        id: productId,
        title: 'Test Product',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
        soldAt: null,
        pausedAt: new Date(),
      });

      await expect(service.addItem(userId, productId, 1)).rejects.toThrow(
        'El vendedor pausó este producto temporalmente y no está disponible',
      );
      expect(mockPrismaService.client.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('should refuse a quantity above the one-of-a-kind cap', async () => {
      await expect(service.addItem('user1', 'product1', 500)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockProductsService.findRaw).not.toHaveBeenCalled();
      expect(mockPrismaService.client.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException (not NotFoundException) with the Spanish "not approved" message when the product is unapproved', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 1;

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
        soldAt: null,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findRaw.mockResolvedValue(mockProduct);

      await expect(
        service.addItem(userId, productId, quantity),
      ).rejects.toThrow('El producto no está aprobado para la venta');
      await expect(
        service.addItem(userId, productId, quantity),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.addItem(userId, productId, quantity),
      ).rejects.not.toThrow(NotFoundException);
      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findRaw).toHaveBeenCalledWith(productId);
      expect(mockProductsService.findOne).not.toHaveBeenCalled();
    });

    it('should refresh the price snapshot (and keep the single unit) when the item is already in the cart', async () => {
      const userId = 'user1';
      const productId = 'product1';

      const mockCart = {
        id: 'cart1',
        userId,
        items: [{ id: 'item1', productId, quantity: 1 }],
      };

      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        // The seller raised the price after the buyer first added the item.
        price: 80.0,
        sellerId: 'seller1',
        isApproved: true,
        soldAt: null,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findRaw.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.upsert.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 1,
        priceAtAdd: 80.0,
      });

      const result = await service.addItem(userId, productId, 1);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findRaw).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart1', productId } },
        // The stale 10.0 snapshot must not survive: the line is re-priced.
        update: { quantity: 1, priceAtAdd: 80.0 },
        create: {
          cartId: 'cart1',
          productId,
          quantity: 1,
          priceAtAdd: 80.0,
        },
        include: {
          product: {
            include: {
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });
      expect(result.quantity).toBe(1);
      expect(result.priceAtAdd).toBe(80.0);
    });

    it('should throw the Spanish message for an invalid quantity', async () => {
      await expect(service.addItem('user1', 'product1', 0)).rejects.toThrow(
        'La cantidad debe ser un número entero positivo',
      );
    });

    it('should resolve concurrent add-to-cart calls for the same product to a single one-unit row (no duplicate line item)', async () => {
      const userId = 'user1';
      const productId = 'product1';

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
        soldAt: null,
      };

      jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockProductsService.findRaw.mockResolvedValue(mockProduct);

      // Simulate the DB-level behavior of two concurrent upserts racing on
      // the (cartId, productId) unique constraint: the first call creates
      // the row, the second updates it instead of creating a duplicate.
      let stored: { id: string; quantity: number } | null = null;
      mockPrismaService.client.cartItem.upsert.mockImplementation(
        ({ update, create }) => {
          if (!stored) {
            stored = { id: 'item1', quantity: create.quantity };
          } else {
            stored.quantity = update.quantity;
          }
          return Promise.resolve({
            id: stored.id,
            cartId: 'cart1',
            productId,
            quantity: stored.quantity,
            priceAtAdd: 10.0,
          });
        },
      );

      const [first, second] = await Promise.all([
        service.addItem(userId, productId, 1),
        service.addItem(userId, productId, 1),
      ]);

      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { cartId_productId: { cartId: 'cart1', productId } },
          update: { quantity: 1, priceAtAdd: 10.0 },
        }),
      );
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { cartId_productId: { cartId: 'cart1', productId } },
          update: { quantity: 1, priceAtAdd: 10.0 },
        }),
      );
      // Both calls resolve to the same underlying row, still holding the single
      // unit that exists, rather than a second row being created.
      expect(first.id).toBe('item1');
      expect(second.id).toBe('item1');
      expect(second.quantity).toBe(1);
    });
  });

  describe('updateItem', () => {
    it('should update cart item quantity', async () => {
      const cartItemId = 'item1';
      const quantity = 1;
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
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
      const quantity = 1;
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.updateItem(cartItemId, quantity, userId),
      ).rejects.toThrow(/No se encontró el producto del carrito con ID .*/);
    });

    it('should throw error if cart item belongs to another user', async () => {
      const cartItemId = 'item1';
      const quantity = 1;
      const userId = 'user1';

      const mockCart = {
        id: 'cart2', // different cart id
        userId,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1', // item belongs to cart1
        cart: { id: 'cart1' },
      });

      await expect(
        service.updateItem(cartItemId, quantity, userId),
      ).rejects.toThrow(
        'No tienes autorización para actualizar este producto del carrito',
      );
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

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
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

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.removeItem(cartItemId, userId)).rejects.toThrow(
        /No se encontró el producto del carrito con ID .*/,
      );
    });

    it('should throw error if cart item belongs to another user', async () => {
      const cartItemId = 'item1';
      const userId = 'user1';

      const mockCart = {
        id: 'cart2', // different cart id
        userId,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockPrismaService.client.cartItem.findUnique.mockResolvedValue({
        id: cartItemId,
        cartId: 'cart1', // item belongs to cart1
        cart: { id: 'cart1' },
      });

      await expect(service.removeItem(cartItemId, userId)).rejects.toThrow(
        'No tienes autorización para eliminar este producto del carrito',
      );
    });
  });

  describe('clearCart', () => {
    it('should clear all items from cart', async () => {
      const userId = 'user1';

      const mockCart = {
        id: 'cart1',
        userId,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);

      await service.clearCart(userId);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.client.cartItem.deleteMany).toHaveBeenCalledWith(
        {
          where: { cartId: 'cart1' },
        },
      );
    });
  });
});
