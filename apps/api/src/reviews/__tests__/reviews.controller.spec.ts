import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ReviewsController } from '../reviews.controller';
import { ReviewsService } from '../reviews.service';
import { AuthRequest } from '../../../src/types/request.types';
import { Role } from '../../users/role.enum';

describe('ReviewsController', () => {
  let controller: ReviewsController;

  const mockReviewsService = {
    findAllByProduct: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getAllReviews: jest.fn(),
    replyToReview: jest.fn(),
    markHelpful: jest.fn(),
    unmarkHelpful: jest.fn(),
  };

  const createMockRes = () => ({ status: jest.fn().mockReturnThis() });

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
    it('should call reviewsService.findAllByProduct with productId', async () => {
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
    it('should call reviewsService.create with body, userId and productId and answer 201 for a new review', async () => {
      const userId = 'user1';
      const body = {
        productId: 'product1',
        rating: 5,
        comment: 'Great product!',
      };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const res = createMockRes();

      const review = {
        id: 'review1',
        ...body,
        userId,
      };

      mockReviewsService.create.mockResolvedValue({ review, created: true });

      const result = await controller.createReview(
        mockReq,
        body,
        res as unknown as Response,
      );

      expect(mockReviewsService.create).toHaveBeenCalledWith(
        body,
        userId,
        body.productId,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(review);
    });

    it('should propagate the duplicate-review rejection as a BadRequestException', async () => {
      // A second POST for the same (user, product) is a rejected request now,
      // not a silent update: edits go through PATCH /reviews/:id.
      const userId = 'user1';
      const body = {
        productId: 'product1',
        rating: 3,
        comment: 'Lo cambié de opinión',
      };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const res = createMockRes();

      mockReviewsService.create.mockRejectedValue(
        new BadRequestException('Ya has reseñado este producto'),
      );

      await expect(
        controller.createReview(mockReq, body, res as unknown as Response),
      ).rejects.toThrow(BadRequestException);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('updateReview', () => {
    it('should call reviewsService.update with id, body, userId and the caller role', async () => {
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
        Role.USER,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('replyToReview', () => {
    it("should call reviewsService.replyToReview with id, the caller's id and the reply text", async () => {
      const sellerId = 'seller1';
      const reviewId = 'review1';
      const body = { reply: 'Gracias por tu compra' };
      const mockReq = {
        user: { id: sellerId, email: 'seller@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { id: reviewId, sellerReply: body.reply };
      mockReviewsService.replyToReview.mockResolvedValue(mockResult);

      const result = await controller.replyToReview(mockReq, reviewId, body);

      expect(mockReviewsService.replyToReview).toHaveBeenCalledWith(
        reviewId,
        sellerId,
        body.reply,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteReview', () => {
    it('should call reviewsService.remove with id, userId and the caller role', async () => {
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

      expect(mockReviewsService.remove).toHaveBeenCalledWith(
        reviewId,
        userId,
        Role.USER,
      );
      expect(result).toEqual(mockResult);
    });

    it('should pass the admin role through so an admin can moderate any review', async () => {
      const reviewId = 'review1';
      const mockReq = {
        user: { id: 'admin1', email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;

      mockReviewsService.remove.mockResolvedValue({ id: reviewId });

      await controller.deleteReview(mockReq, reviewId);

      expect(mockReviewsService.remove).toHaveBeenCalledWith(
        reviewId,
        'admin1',
        Role.ADMIN,
      );
    });
  });

  describe('markHelpful', () => {
    it("should call reviewsService.markHelpful with the review id and the caller's id", async () => {
      const userId = 'buyer1';
      const reviewId = 'review1';
      const mockReq = {
        user: { id: userId, email: 'buyer@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { helpfulCount: 1, votedByMe: true };
      mockReviewsService.markHelpful.mockResolvedValue(mockResult);

      const result = await controller.markHelpful(mockReq, reviewId);

      expect(mockReviewsService.markHelpful).toHaveBeenCalledWith(
        reviewId,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('unmarkHelpful', () => {
    it("should call reviewsService.unmarkHelpful with the review id and the caller's id", async () => {
      const userId = 'buyer1';
      const reviewId = 'review1';
      const mockReq = {
        user: { id: userId, email: 'buyer@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { helpfulCount: 0, votedByMe: false };
      mockReviewsService.unmarkHelpful.mockResolvedValue(mockResult);

      const result = await controller.unmarkHelpful(mockReq, reviewId);

      expect(mockReviewsService.unmarkHelpful).toHaveBeenCalledWith(
        reviewId,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllReviews', () => {
    it('should call reviewsService.getAllReviews with query', async () => {
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
