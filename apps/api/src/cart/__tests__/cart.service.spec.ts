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
        upsert: jest.fn(),
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
    it('should upsert a new item into the cart', async () => {
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

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.upsert.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 2,
        priceAtAdd: 10.0,
      });

      const result = await service.addItem(userId, productId, quantity);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart1', productId } },
        update: { quantity: { increment: 2 } },
        create: {
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
      expect(result).toEqual({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 2,
        priceAtAdd: 10.0,
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

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      await expect(
        service.addItem(userId, productId, quantity),
      ).rejects.toThrow('El producto no está aprobado para la venta');
    });

    it('should increment quantity via upsert when item already exists', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 2;

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
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
      };

      const getCartSpy = jest
        .spyOn(service, 'getCart')
        .mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);
      mockPrismaService.client.cartItem.upsert.mockResolvedValue({
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity: 3, // 1 + 2
        priceAtAdd: 10.0,
      });

      const result = await service.addItem(userId, productId, quantity);

      expect(getCartSpy).toHaveBeenCalledWith(userId);
      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart1', productId } },
        update: { quantity: { increment: 2 } },
        create: {
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
      expect(result.quantity).toBe(3);
    });

    it('should throw the Spanish message for an invalid quantity', async () => {
      await expect(
        service.addItem('user1', 'product1', 0),
      ).rejects.toThrow('La cantidad debe ser un número entero positivo');
    });

    it('should resolve concurrent add-to-cart calls for the same product to a single summed row (no duplicate line item)', async () => {
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
      };

      jest.spyOn(service, 'getCart').mockResolvedValue(mockCart as any);
      mockProductsService.findOne.mockResolvedValue(mockProduct);

      // Simulate the DB-level behavior of two concurrent upserts racing on
      // the (cartId, productId) unique constraint: the first call creates
      // the row, the second increments it instead of creating a duplicate.
      let stored: { id: string; quantity: number } | null = null;
      mockPrismaService.client.cartItem.upsert.mockImplementation(
        ({ update, create }) => {
          if (!stored) {
            stored = { id: 'item1', quantity: create.quantity };
          } else {
            stored.quantity += update.quantity.increment;
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

      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenCalledTimes(
        2,
      );
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { cartId_productId: { cartId: 'cart1', productId } },
          update: { quantity: { increment: 1 } },
        }),
      );
      expect(mockPrismaService.client.cartItem.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { cartId_productId: { cartId: 'cart1', productId } },
          update: { quantity: { increment: 1 } },
        }),
      );
      // Both calls resolve to the same underlying row, with the quantity
      // summed rather than a second row being created.
      expect(first.id).toBe('item1');
      expect(second.id).toBe('item1');
      expect(second.quantity).toBe(2);
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
      const quantity = 5;
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
      const quantity = 5;
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
