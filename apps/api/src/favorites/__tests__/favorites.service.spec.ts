import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FavoritesService } from '../favorites.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockPrismaService = {
    client: {
      favorite: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return the user favorites newest-first with product and seller included', async () => {
      const userId = 'user1';
      const mockFavorites = [
        { id: 'fav1', userId, productId: 'product1', createdAt: new Date() },
      ];

      mockPrismaService.client.favorite.findMany.mockResolvedValue(
        mockFavorites,
      );

      const result = await service.findAll(userId);

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: { seller: { select: { id: true, name: true } } },
          },
        },
      });
      expect(result).toEqual(mockFavorites);
    });
  });

  describe('addFavorite', () => {
    it('should verify the product exists then upsert the favorite', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockProduct = { id: productId, title: 'Test Product' };
      const mockFavorite = { id: 'fav1', userId, productId };

      mockProductsService.findRaw.mockResolvedValue(mockProduct);
      mockPrismaService.client.favorite.upsert.mockResolvedValue(mockFavorite);

      const result = await service.addFavorite(userId, productId);

      expect(mockProductsService.findRaw).toHaveBeenCalledWith(productId);
      expect(mockPrismaService.client.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_productId: { userId, productId } },
        update: {},
        create: { userId, productId },
        include: {
          product: {
            include: { seller: { select: { id: true, name: true } } },
          },
        },
      });
      expect(result).toEqual(mockFavorite);
    });

    it('should propagate NotFoundException when the product does not exist', async () => {
      const userId = 'user1';
      const productId = 'missing-product';

      mockProductsService.findRaw.mockRejectedValue(
        new NotFoundException(`Producto con ID ${productId} no encontrado`),
      );

      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.favorite.upsert).not.toHaveBeenCalled();
    });

    it('should be idempotent when the product is already a favorite', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockProduct = { id: productId, title: 'Test Product' };
      const mockFavorite = { id: 'fav1', userId, productId };

      mockProductsService.findRaw.mockResolvedValue(mockProduct);
      mockPrismaService.client.favorite.upsert.mockResolvedValue(mockFavorite);

      const [first, second] = await Promise.all([
        service.addFavorite(userId, productId),
        service.addFavorite(userId, productId),
      ]);

      expect(mockPrismaService.client.favorite.upsert).toHaveBeenCalledTimes(2);
      expect(first).toEqual(mockFavorite);
      expect(second).toEqual(mockFavorite);
    });
  });

  describe('removeFavorite', () => {
    it('should delete the favorite when it exists', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockFavorite = { id: 'fav1', userId, productId };

      mockPrismaService.client.favorite.findUnique.mockResolvedValue(
        mockFavorite,
      );

      const result = await service.removeFavorite(userId, productId);

      expect(mockPrismaService.client.favorite.findUnique).toHaveBeenCalledWith(
        { where: { userId_productId: { userId, productId } } },
      );
      expect(mockPrismaService.client.favorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException in Spanish when the favorite does not exist', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockPrismaService.client.favorite.findUnique.mockResolvedValue(null);

      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        'Este producto no está en tus favoritos',
      );
      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.favorite.delete).not.toHaveBeenCalled();
    });

    it('should not remove a favorite belonging to another user', async () => {
      // The compound unique key is scoped to (userId, productId), so a lookup
      // for someone else's userId can never resolve to this user's favorite.
      const userId = 'user1';
      const productId = 'product1';

      mockPrismaService.client.favorite.findUnique.mockResolvedValue(null);

      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.favorite.findUnique).toHaveBeenCalledWith(
        { where: { userId_productId: { userId, productId } } },
      );
    });
  });
});
