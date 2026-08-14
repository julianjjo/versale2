import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from '../reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../users/role.enum';

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
        productId,
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

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );
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
      expect(result).toEqual({ review: mockReview, created: true });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      const userId = 'user1';
      const productId = 'nonexistent';
      const createReviewDto = {
        productId,
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
        productId,
        rating: 5,
        comment: 'Great product!',
      };

      const mockProduct = {
        id: productId,
        isApproved: false,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.create(createReviewDto, userId, productId),
      ).rejects.toThrow('El producto no está aprobado para la venta');
    });

    it('should throw error if the seller reviews their own product', async () => {
      const userId = 'seller1';
      const productId = 'product1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        isApproved: true,
        sellerId: userId,
      });

      await expect(
        service.create({ productId, rating: 5 }, userId, productId),
      ).rejects.toThrow('No puedes reseñar tu propio producto');
    });

    it('should update the existing review and report it as not created when the user already reviewed the product', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const createReviewDto = {
        productId,
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

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );
      mockPrismaService.client.review.findFirst.mockResolvedValue(
        existingReview,
      );
      mockPrismaService.client.review.update.mockResolvedValue(updatedReview);

      const result = await service.create(createReviewDto, userId, productId);

      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: existingReview.id },
        data: {
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
        },
      });
      // created: false is what lets the controller answer 200 instead of 201.
      expect(result).toEqual({ review: updatedReview, created: false });
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

      mockPrismaService.client.review.findUnique.mockResolvedValue(
        existingReview,
      );
      mockPrismaService.client.review.update.mockResolvedValue(updatedReview);

      const result = await service.update(
        reviewId,
        updateReviewDto,
        userId,
        Role.USER,
      );

      expect(mockPrismaService.client.review.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: { rating: 4, comment: 'Updated comment' },
      });
      expect(result).toEqual(updatedReview);
    });

    it('should never let userId or productId reach Prisma, even if they slip past validation', async () => {
      const reviewId = 'review1';
      const userId = 'user1';

      mockPrismaService.client.review.findUnique.mockResolvedValue({
        id: reviewId,
        userId,
        productId: 'product1',
      });
      mockPrismaService.client.review.update.mockResolvedValue({
        id: reviewId,
      });

      await service.update(
        reviewId,
        {
          rating: 4,
          comment: 'ok',
          userId: 'someoneElse',
          productId: 'anotherProduct',
        } as any,
        userId,
        Role.USER,
      );

      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: { rating: 4, comment: 'ok' },
      });
    });

    it('should throw NotFoundException if review not found', async () => {
      const reviewId = 'nonexistent';
      const userId = 'user1';
      const updateReviewDto = { rating: 4 };

      mockPrismaService.client.review.findUnique.mockResolvedValue(null);

      await expect(
        service.update(reviewId, updateReviewDto, userId, Role.USER),
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

      mockPrismaService.client.review.findUnique.mockResolvedValue(
        existingReview,
      );

      await expect(
        service.update(reviewId, updateReviewDto, userId, Role.USER),
      ).rejects.toThrow('No tienes autorización para actualizar esta reseña');
    });

    it("should let an admin moderate another user's review", async () => {
      const reviewId = 'review1';

      mockPrismaService.client.review.findUnique.mockResolvedValue({
        id: reviewId,
        userId: 'someoneElse',
      });
      mockPrismaService.client.review.update.mockResolvedValue({
        id: reviewId,
        comment: 'Contenido moderado',
      });

      const result = await service.update(
        reviewId,
        { comment: 'Contenido moderado' },
        'admin1',
        Role.ADMIN,
      );

      expect(result).toEqual({
        id: reviewId,
        comment: 'Contenido moderado',
      });
    });
  });

  describe('replyToReview', () => {
    it("should let the product's seller reply to a review", async () => {
      const reviewId = 'review1';
      const sellerId = 'seller1';

      mockPrismaService.client.review.findUnique.mockResolvedValue({
        id: reviewId,
        product: { sellerId },
      });
      mockPrismaService.client.review.update.mockResolvedValue({
        id: reviewId,
        sellerReply: 'Gracias por tu compra',
      });

      const result = await service.replyToReview(
        reviewId,
        sellerId,
        'Gracias por tu compra',
      );

      expect(mockPrismaService.client.review.findUnique).toHaveBeenCalledWith({
        where: { id: reviewId },
        include: { product: { select: { sellerId: true } } },
      });
      expect(mockPrismaService.client.review.update).toHaveBeenCalledWith({
        where: { id: reviewId },
        data: {
          sellerReply: 'Gracias por tu compra',
          sellerRepliedAt: expect.any(Date),
        },
      });
      expect(result).toEqual({
        id: reviewId,
        sellerReply: 'Gracias por tu compra',
      });
    });

    it('should let the seller edit an existing reply', async () => {
      const reviewId = 'review1';
      const sellerId = 'seller1';

      mockPrismaService.client.review.findUnique.mockResolvedValue({
        id: reviewId,
        product: { sellerId },
        sellerReply: 'Respuesta anterior',
      });
      mockPrismaService.client.review.update.mockResolvedValue({
        id: reviewId,
        sellerReply: 'Respuesta corregida',
      });

      const result = await service.replyToReview(
        reviewId,
        sellerId,
        'Respuesta corregida',
      );

      expect(result.sellerReply).toBe('Respuesta corregida');
    });

    it('should reject a reply from someone who is not the product\'s seller', async () => {
      const reviewId = 'review1';

      mockPrismaService.client.review.findUnique.mockResolvedValue({
        id: reviewId,
        product: { sellerId: 'seller1' },
      });

      await expect(
        service.replyToReview(reviewId, 'someoneElse', 'No autorizado'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.client.review.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when the review does not exist', async () => {
      mockPrismaService.client.review.findUnique.mockResolvedValue(null);

      await expect(
        service.replyToReview('nonexistent', 'seller1', 'Hola'),
      ).rejects.toThrow(NotFoundException);
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

      mockPrismaService.client.review.findUnique.mockResolvedValue(
        existingReview,
      );
      mockPrismaService.client.review.delete.mockResolvedValue(existingReview);

      const result = await service.remove(reviewId, userId, Role.USER);

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

      await expect(service.remove(reviewId, userId, Role.USER)).rejects.toThrow(
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

      mockPrismaService.client.review.findUnique.mockResolvedValue(
        existingReview,
      );

      await expect(service.remove(reviewId, userId, Role.USER)).rejects.toThrow(
        'No tienes autorización para eliminar esta reseña',
      );
      await expect(service.remove(reviewId, userId, Role.USER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should let an admin delete another user's abusive review", async () => {
      const reviewId = 'review1';
      const existingReview = { id: reviewId, userId: 'someoneElse' };

      mockPrismaService.client.review.findUnique.mockResolvedValue(
        existingReview,
      );
      mockPrismaService.client.review.delete.mockResolvedValue(existingReview);

      const result = await service.remove(reviewId, 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.review.delete).toHaveBeenCalledWith({
        where: { id: reviewId },
      });
      expect(result).toEqual(existingReview);
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
        take: 10,
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

    it('should clamp an out-of-range page and limit and report the sanitized values in meta', async () => {
      mockPrismaService.client.review.findMany.mockResolvedValue([]);
      mockPrismaService.client.review.count.mockResolvedValue(0);

      const result = await service.getAllReviews({ page: '0', limit: '99999' });

      expect(mockPrismaService.client.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 100,
        pages: 0,
      });
    });
  });
});
