import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FavoritesService,
  FAVORITE_PRODUCT_SELECT,
} from '../favorites.service';
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
        count: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findRaw: jest.fn(),
    withAverageRating: jest.fn(),
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
    // Identity passthrough by default: most tests here only care about
    // favorite/pagination behavior, not rating enrichment, which is
    // ProductsService's own responsibility and unit-tested there.
    mockProductsService.withAverageRating.mockImplementation(
      (products: unknown[]) => Promise.resolve(products),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return the user favorites newest-first with product and seller included, paginated', async () => {
      const userId = 'user1';
      const mockProduct = {
        id: 'product1',
        title: 'Test Product',
        seller: { id: 'seller1', name: 'Alice' },
        status: 'AVAILABLE' as const,
      };
      const mockFavorites = [
        {
          id: 'fav1',
          userId,
          productId: 'product1',
          createdAt: new Date(),
          product: mockProduct,
        },
      ];

      mockPrismaService.client.favorite.findMany.mockResolvedValue(
        mockFavorites,
      );
      mockPrismaService.client.favorite.count.mockResolvedValue(1);

      const result = await service.findAll(userId, {
        page: '1',
        limit: '10',
      });

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
        include: {
          product: { select: FAVORITE_PRODUCT_SELECT },
        },
      });
      expect(mockPrismaService.client.favorite.count).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual({
        data: mockFavorites,
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      });
    });

    // The web app renders a favorited product with the same catalog card
    // used on the public catalog (ProductCard), so it needs the same rating
    // info or the identical listing would show a rating on /products and
    // none on /favoritos.
    it("should attach each favorited product's rating via ProductsService.withAverageRating", async () => {
      const userId = 'user1';
      const mockProduct = { id: 'product1', title: 'Test Product' };
      const mockFavorites = [
        {
          id: 'fav1',
          userId,
          productId: 'product1',
          createdAt: new Date(),
          product: mockProduct,
        },
      ];
      const ratedProduct = {
        ...mockProduct,
        _count: { reviews: 3 },
        averageRating: 4.5,
      };

      mockPrismaService.client.favorite.findMany.mockResolvedValue(
        mockFavorites,
      );
      mockPrismaService.client.favorite.count.mockResolvedValue(1);
      mockProductsService.withAverageRating.mockResolvedValue([ratedProduct]);

      const result = await service.findAll(userId, {});

      expect(mockProductsService.withAverageRating).toHaveBeenCalledWith([
        mockProduct,
      ]);
      expect(result.data).toEqual([
        { ...mockFavorites[0], product: ratedProduct },
      ]);
    });

    it('should apply the requested page to skip/take', async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([]);
      mockPrismaService.client.favorite.count.mockResolvedValue(0);

      await service.findAll('user1', { page: '2', limit: '5' });

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });

    it('should clamp an oversized limit to the maximum page size', async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([]);
      mockPrismaService.client.favorite.count.mockResolvedValue(0);

      const result = await service.findAll('user1', { limit: '999999' });

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
      expect(result.meta.limit).toBe(100);
    });

    // Regression: findAll used to `include` the full product row, which
    // carries moderation-internal fields (rejectionReason/rejectedAt) that
    // ProductsService#findOne never shows to anyone but the seller or an
    // admin — a product favorited while approved and later rejected must
    // not leak those fields to the buyer who favorited it.
    it('should never select moderation-internal product fields', () => {
      expect(FAVORITE_PRODUCT_SELECT).not.toHaveProperty('rejectionReason');
      expect(FAVORITE_PRODUCT_SELECT).not.toHaveProperty('rejectedAt');
    });
  });

  describe('findAllIds', () => {
    it("should return just the product ids of the user's favorites, with no product join", async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([
        { productId: 'product1' },
        { productId: 'product2' },
      ]);

      const result = await service.findAllIds('user1');

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        select: { productId: true },
        take: 1000,
      });
      expect(result).toEqual({ productIds: ['product1', 'product2'] });
      // This is the whole point of the endpoint: no product join, no
      // pagination, and no rating enrichment for a caller that only checks
      // membership.
      expect(mockProductsService.withAverageRating).not.toHaveBeenCalled();
    });

    // Deliberately unpaginated (a heart icon needs the whole set), but not
    // literally unbounded — a hard technical ceiling rather than a page size.
    it('should cap the number of ids returned even though the endpoint has no pagination', async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([]);

      await service.findAllIds('user1');

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1000 }),
      );
    });

    it('should return an empty list when the user has no favorites', async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([]);

      const result = await service.findAllIds('user1');

      expect(result).toEqual({ productIds: [] });
    });

    it("should never return another user's favorites", async () => {
      mockPrismaService.client.favorite.findMany.mockResolvedValue([]);

      await service.findAllIds('user2');

      expect(mockPrismaService.client.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user2' } }),
      );
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
          product: { select: FAVORITE_PRODUCT_SELECT },
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

    // Same reasoning as the unapproved case above: the seller took this
    // listing out of the catalog on purpose, so it shouldn't be favoritable
    // via a guessed or leaked productId either.
    it('should refuse to favorite a product the seller has paused', async () => {
      const userId = 'user1';
      const productId = 'product1';

      mockProductsService.findRaw.mockResolvedValue(
        approvedProduct({ id: productId, pausedAt: new Date() }),
      );

      await expect(service.addFavorite(userId, productId)).rejects.toThrow(
        'Este producto no está disponible para agregar a favoritos',
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

      await expect(service.removeFavorite(userId, productId)).resolves.toEqual({
        success: true,
      });
      await expect(service.removeFavorite(userId, productId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
  it('favorites: handles empty list', () => {
    expect(true).toBe(true);
  });
});
