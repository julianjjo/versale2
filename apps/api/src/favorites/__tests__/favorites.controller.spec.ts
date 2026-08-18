import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from '../favorites.controller';
import { FavoritesService } from '../favorites.service';
import { AuthRequest } from '../../types/request.types';

describe('FavoritesController', () => {
  let controller: FavoritesController;

  const mockFavoritesService = {
    findAll: jest.fn(),
    findAllIds: jest.fn(),
    addFavorite: jest.fn(),
    removeFavorite: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFavorites', () => {
    it('should call favoritesService.findAll with userId and query from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const query = { page: '2', limit: '5' };

      const mockResult = {
        data: [{ id: 'fav1', userId, productId: 'product1' }],
        meta: { total: 1, page: 2, limit: 5, pages: 1 },
      };
      mockFavoritesService.findAll.mockResolvedValue(mockResult);

      const result = await controller.getFavorites(mockReq, query);

      expect(mockFavoritesService.findAll).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getFavoriteIds', () => {
    it('should call favoritesService.findAllIds with userId from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { productIds: ['product1', 'product2'] };
      mockFavoritesService.findAllIds.mockResolvedValue(mockResult);

      const result = await controller.getFavoriteIds(mockReq);

      expect(mockFavoritesService.findAllIds).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('addFavorite', () => {
    it('should call favoritesService.addFavorite with userId and productId', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { id: 'fav1', userId, productId };
      mockFavoritesService.addFavorite.mockResolvedValue(mockResult);

      const result = await controller.addFavorite(mockReq, productId);

      expect(mockFavoritesService.addFavorite).toHaveBeenCalledWith(
        userId,
        productId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('removeFavorite', () => {
    it('should call favoritesService.removeFavorite with userId and productId', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { success: true };
      mockFavoritesService.removeFavorite.mockResolvedValue(mockResult);

      const result = await controller.removeFavorite(mockReq, productId);

      expect(mockFavoritesService.removeFavorite).toHaveBeenCalledWith(
        userId,
        productId,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
