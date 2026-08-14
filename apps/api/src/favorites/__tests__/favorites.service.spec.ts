import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FavoritesService } from '../favorites.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';

// Simulates the error Prisma throws when `delete`'s compound-key `where`
// matches no row — the shape two concurrent unfavorite calls would trigger.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('FavoritesService', () => {
  let service: FavoritesService;

  const mockPrismaService = {
    client: {
      favorite: {
        findMany: jest.fn(),
        upsert: jest.fn(),
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
    const approvedProduct = (overrides = {}) => ({
      id: 'product1',
      title: 'Test Product',
      sellerId: 'seller1',
      isApproved: true,
      ...overrides,
    });

    it('should verify the product exists then upsert the favorite', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockProduct = approvedProduct({ id: productId });
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
      const mockProduct = approvedProduct({ id: productId });
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

    // Regression: a guessed or leaked productId for a pending/rejected
    // listing used to be favoritable even though the catalog and product
    // page both hide it from anyone but its seller or an admin.
    it('should refuse to favorite a product that is not approved', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockProductsService.findRaw.mockResolvedValue(
        approvedProduct({ id: productId, isApproved: false }),
      );

      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        'Este producto no está disponible para agregar a favoritos',
      );
      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.favorite.upsert).not.toHaveBeenCalled();
    });

    it('should refuse to let a seller favorite their own product', async () => {
      const userId = 'seller1';
      const productId = 'product1';

      mockProductsService.findRaw.mockResolvedValue(
        approvedProduct({ id: productId, sellerId: userId }),
      );

      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        'No puedes agregar tu propio producto a favoritos',
      );
      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.client.favorite.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeFavorite', () => {
    it('should delete the favorite by its compound key', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockPrismaService.client.favorite.delete.mockResolvedValue({
        id: 'fav1',
        userId,
        productId,
      });

      const result = await service.removeFavorite(userId, productId);

      expect(mockPrismaService.client.favorite.delete).toHaveBeenCalledWith({
        where: { userId_productId: { userId, productId } },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException in Spanish when the favorite does not exist', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockPrismaService.client.favorite.delete.mockRejectedValue(
        notFoundError(),
      );

      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        'Este producto no está en tus favoritos',
      );
      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    // Regression: two concurrent unfavorite calls (two tabs, a retried
    // request) both pass the compound-key delete; the second one used to hit
    // an unhandled Prisma P2025 instead of the same clean 404.
    it('should turn a concurrent double-delete into the same 404 instead of an unhandled error', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockPrismaService.client.favorite.delete
        .mockResolvedValueOnce({ id: 'fav1', userId, productId })
        .mockRejectedValueOnce(notFoundError());

      await expect(
        service.removeFavorite(userId, productId),
      ).resolves.toEqual({ success: true });
      await expect(
        service.removeFavorite(userId, productId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
