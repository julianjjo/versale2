import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from '../reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      product: {
        findUnique: jest.fn(),
      },
      review: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new review if product exists and is approved', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const createReviewDto = {
        rating: 5,
        comment: 'Great product!',
      };

      const mockProduct = {
        id: productId,
        isApproved: true,
      };

      const mockReview = {
        id: 'review1',
        userId,
        productId,
        rating: 5,
        comment: 'Great product!',
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.client.review.findFirst.mockResolvedValue(null);
      mockPrismaService.client.review.create.mockResolvedValue(mockReview);

      const result = await service.create(createReviewDto, userId, productId);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(mockPrismaService.client.review.findFirst).toHaveBeenCalledWith({
        where: { userId, productId },
      });
      expect(mockPrismaService.client.review.create).toHaveBeenCalledWith({
        data: {
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
          userId,
          productId,
        },
      });
      expect(result).toEqual(mockReview);
    });

    it('should throw NotFoundException if product does not exist', async () => {
      const userId = 'user1';
      const productId = 'nonexistent';
      const createReviewDto = {
        rating: 5,
        comment: 'Great product!',
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(createReviewDto, userId, productId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if product is not approved', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const createReviewDto = {
        rating: 5,
        comment: 'Great product!',
      };

      const mockProduct = {
        id: productId,
        isApproved: false,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.create(createReviewDto, userId, productId),
      ).rejects.toThrow('Product is not approved for sale');
    });

    it('should update existing review if user already reviewed the product', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const createReviewDto = {
        rating: 4,
        comment: 'Updated review',
      };

      const mockProduct = {
        id: productId,
        isApproved: true,
      };

      const existingReview = {
        id: 'review1',
        userId,
        productId,
        rating: 5,
        comment: 'Old review',
      };

      const updatedReview = {
        id: 'review1',
        userId,
        productId,
        rating: 4,
        comment: 'Updated review',
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.client.review.findFirst.mockResolvedValue(existingReview);
      mockPrismaService.client.review.update.mockResolvedValue(updatedReview);

      const result = await service.create(createReviewDto, userId, productId);

      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: existingReview.id },
        data: {
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
        },
      });
      expect(result).toEqual(updatedReview);
    });
  });

  describe('findAllByProduct', () => {
    it('should return reviews for a product', async () => {
      const productId = 'product1';
      const mockReviews = [
        {
          id: 'review1',
          rating: 5,
          comment: 'Great!',
          user: { id: 'user1', name: 'User 1' },
        },
      ];

      mockPrismaService.client.review.findMany.mockResolvedValue(mockReviews);

      const result = await service.findAllByProduct(productId);

      expect(mockPrismaService.client.review.findMany).toHaveBeenCalledWith({
        where: { productId },
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockReviews);
    });
  });

  describe('update', () => {
    it('should update a review if user is the author', async () => {
      const reviewId = 'review1';
      const userId = 'user1';
      const updateReviewDto = {
        rating: 4,
        comment: 'Updated comment',
      };

      const existingReview = {
        id: reviewId,
        userId,
        productId: 'product1',
      };

      const updatedReview = {
        id: reviewId,
        rating: 4,
        comment: 'Updated comment',
      };

      mockPrismaService.client.review.findUnique.mockResolvedValue(existingReview);
      mockPrismaService.client.review.update.mockResolvedValue(updatedReview);

      const result = await service.update(reviewId, updateReviewDto, userId);

      expect(mockPrismaService.client.review.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: updateReviewDto,
      });
      expect(result).toEqual(updatedReview);
    });

    it('should throw NotFoundException if review not found', async () => {
      const reviewId = 'nonexistent';
      const userId = 'user1';
      const updateReviewDto = { rating: 4 };

      mockPrismaService.client.review.findUnique.mockResolvedValue(null);

      await expect(
        service.update(reviewId, updateReviewDto, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is not the author', async () => {
      const reviewId = 'review1';
      const userId = 'user1';
      const wrongUserId = 'user2';
      const updateReviewDto = { rating: 4 };

      const existingReview = {
        id: reviewId,
        userId: wrongUserId, // different user
      };

      mockPrismaService.client.review.findUnique.mockResolvedValue(existingReview);

      await expect(
        service.update(reviewId, updateReviewDto, userId),
      ).rejects.toThrow('Not authorized to update this review');
    });
  });

  describe('remove', () => {
    it('should remove a review if user is the author', async () => {
      const reviewId = 'review1';
      const userId = 'user1';

      const existingReview = {
        id: reviewId,
        userId,
      };

      mockPrismaService.client.review.findUnique.mockResolvedValue(existingReview);
      mockPrismaService.client.review.delete.mockResolvedValue(existingReview);

      const result = await service.remove(reviewId, userId);

      expect(mockPrismaService.client.review.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(mockPrismaService.client.review.delete).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(result).toEqual(existingReview);
    });

    it('should throw NotFoundException if review not found', async () => {
      const reviewId = 'nonexistent';
      const userId = 'user1';

      mockPrismaService.client.review.findUnique.mockResolvedValue(null);

      await expect(service.remove(reviewId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if user is not the author', async () => {
      const reviewId = 'review1';
      const userId = 'user1';
      const wrongUserId = 'user2';

      const existingReview = {
        id: reviewId,
        userId: wrongUserId, // different user
      };

      mockPrismaService.client.review.findUnique.mockResolvedValue(existingReview);

      await expect(service.remove(reviewId, userId)).rejects.toThrow(
        'Not authorized to delete this review',
      );
    });
  });

  describe('getAllReviews', () => {
    it('should return paginated reviews for admin', async () => {
      const query = { page: '1', limit: '10' };
      const mockReviews = [
        {
          id: 'review1',
          rating: 5,
          user: { id: 'user1', name: 'User 1' },
          product: { id: 'product1', title: 'Product 1' },
        },
      ];

      const mockTotal = 1;

      mockPrismaService.client.review.findMany.mockResolvedValue(mockReviews);
      mockPrismaService.client.review.count.mockResolvedValue(mockTotal);

      const result = await service.getAllReviews(query);

      expect(mockPrismaService.client.review.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: '10', // limit remains as string
        include: {
          user: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrismaService.client.review.count).toHaveBeenCalledWith();
      expect(result).toEqual({
        data: mockReviews,
        meta: {
          total: 1,
          page: 1, // converted to number
          limit: 10, // converted to number
          pages: 1,
        },
      });
    });
  });
});