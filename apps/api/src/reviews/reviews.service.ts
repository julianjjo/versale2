import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateReviewInput {
  rating: number;
  comment?: string;
}

interface UpdateReviewInput {
  rating?: number;
  comment?: string;
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createReviewDto: CreateReviewInput,
    userId: string,
    productId: string,
  ) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    if (!product.isApproved) {
      throw new BadRequestException('Product is not approved for sale');
    }

    if (product.sellerId === userId) {
      throw new BadRequestException('You cannot review your own product');
    }

    const existingReview = await this.prisma.client.review.findFirst({
      where: { userId, productId },
    });

    if (existingReview) {
      return this.prisma.client.review.update({
        where: { id: existingReview.id },
        data: {
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
        },
      });
    }

    return this.prisma.client.review.create({
      data: {
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        userId,
        productId,
      },
    });
  }

  async findAllByProduct(productId: string) {
    return this.prisma.client.review.findMany({
      where: { productId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, updateReviewDto: UpdateReviewInput, userId: string) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('Not authorized to update this review');
    }

    return this.prisma.client.review.update({
      where: { id },
      data: updateReviewDto,
    });
  }

  async remove(id: string, userId: string) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('Not authorized to delete this review');
    }

    return this.prisma.client.review.delete({ where: { id } });
  }

  async getAllReviews(query: Record<string, unknown>) {
    const { page = 1, limit = 10 } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      this.prisma.client.review.findMany({
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.review.count(),
    ]);

    return {
      data: reviews,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }
}
