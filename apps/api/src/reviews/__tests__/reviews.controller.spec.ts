import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from '../reviews.controller';
import { ReviewsService } from '../reviews.service';
import { AuthRequest } from '../../../src/types/request.types';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  const mockReviewsService = {
    findAllByProduct: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getAllReviews: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockReviewsService }],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getReviewsByProduct', () => {
    it('should call mockReviewsService.findAllByProduct with productId', async () => {
      const productId = 'product1';
      const mockResult = [
        {
          id: 'review1',
          rating: 5,
          comment: 'Great!',
        },
      ];

      mockReviewsService.findAllByProduct.mockResolvedValue(mockResult);

      const result = await controller.getReviewsByProduct(productId);

      expect(mockReviewsService.findAllByProduct).toHaveBeenCalledWith(
        productId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('createReview', () => {
    it('should call mockReviewsService.create with body, userId and productId', async () => {
      const userId = 'user1';
      const body = {
        productId: 'product1',
        rating: 5,
        comment: 'Great product!',
      };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: 'review1',
        ...body,
        userId,
      };

      mockReviewsService.create.mockResolvedValue(mockResult);

      const result = await controller.createReview(mockReq, body);

      expect(mockReviewsService.create).toHaveBeenCalledWith(
        body,
        userId,
        body.productId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateReview', () => {
    it('should call mockReviewsService.update with id, body and userId', async () => {
      const userId = 'user1';
      const reviewId = 'review1';
      const body = {
        rating: 4,
        comment: 'Updated comment',
      };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: reviewId,
        ...body,
      };

      mockReviewsService.update.mockResolvedValue(mockResult);

      const result = await controller.updateReview(mockReq, reviewId, body);

      expect(mockReviewsService.update).toHaveBeenCalledWith(
        reviewId,
        body,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteReview', () => {
    it('should call mockReviewsService.remove with id and userId', async () => {
      const userId = 'user1';
      const reviewId = 'review1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: reviewId,
      };

      mockReviewsService.remove.mockResolvedValue(mockResult);

      const result = await controller.deleteReview(mockReq, reviewId);

      expect(mockReviewsService.remove).toHaveBeenCalledWith(reviewId, userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllReviews', () => {
    it('should call mockReviewsService.getAllReviews with query', async () => {
      const query = { page: '1', limit: '10' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      };

      mockReviewsService.getAllReviews.mockResolvedValue(mockResult);

      const result = await controller.getAllReviews(query);

      expect(mockReviewsService.getAllReviews).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });
});
