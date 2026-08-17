import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Role } from '../users/role.enum';
import { resolvePagination } from '../common/pagination';
import { VERIFIED_PURCHASE_STATUSES } from '../orders/order-status.enum';
import { translatePrismaError } from '../common/prisma-error';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(
    createReviewDto: CreateReviewDto,
    userId: string,
    productId: string,
  ) {
    const product = await this.prisma.client.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
    }

    if (!product.isApproved) {
      throw new BadRequestException(
        'El producto no está aprobado para la venta',
      );
    }

    if (product.sellerId === userId) {
      throw new BadRequestException('No puedes reseñar tu propio producto');
    }

    const existingReview = await this.prisma.client.review.findFirst({
      where: { userId, productId },
    });

    if (existingReview) {
      const review = await this.prisma.client.review.update({
        where: { id: existingReview.id },
        data: {
          rating: createReviewDto.rating,
          comment: createReviewDto.comment,
        },
      });

      return { review, created: false };
    }

    const review = await this.prisma.client.review.create({
      data: {
        rating: createReviewDto.rating,
        comment: createReviewDto.comment,
        userId,
        productId,
      },
    });

    return { review, created: true };
  }

  async findAllByProduct(productId: string) {
    // Every listing is a single physical garment, never restocked — so at
    // most one order item can ever record its actual sale. Whoever that
    // order belongs to (if it went through) is the one buyer a review can
    // count as "verified": someone else's review on the same listing is
    // necessarily not from someone who bought this exact item.
    const [reviews, sale] = await Promise.all([
      this.prisma.client.review.findMany({
        where: { productId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.orderItem.findFirst({
        where: {
          productId,
          order: { status: { in: VERIFIED_PURCHASE_STATUSES } },
        },
        select: { order: { select: { userId: true } } },
      }),
    ]);

    const verifiedBuyerId = sale?.order.userId;

    return reviews.map((review) => ({
      ...review,
      verifiedPurchase: review.userId === verifiedBuyerId,
    }));
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
    role: Role,
  ) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`No se encontró la reseña con ID ${id}`);
    }

    if (review.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para actualizar esta reseña',
      );
    }

    // Defence in depth: only the two editable fields ever reach Prisma, so even
    // if validation were bypassed again, userId/productId stay unwritable.
    const { rating, comment } = updateReviewDto;

    return this.prisma.client.review.update({
      where: { id },
      data: { rating, comment },
    });
  }

  async replyToReview(id: string, sellerId: string, reply: string) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
      include: { product: { select: { sellerId: true } } },
    });

    if (!review) {
      throw new NotFoundException(`No se encontró la reseña con ID ${id}`);
    }

    // Only the product's own seller responds to feedback on it — not any
    // seller, and not the reviewer themselves editing their own review text.
    if (review.product.sellerId !== sellerId) {
      throw new ForbiddenException(
        'Solo el vendedor del producto puede responder esta reseña',
      );
    }

    return this.prisma.client.review.update({
      where: { id },
      data: { sellerReply: reply, sellerRepliedAt: new Date() },
    });
  }

  // Marking twice is a no-op, not an error — mirrors
  // FavoritesService#addFavorite's own upsert-on-a-compound-unique-key.
  async markHelpful(reviewId: string, userId: string) {
    const review = await this.prisma.client.review.findUnique({
      where: { id: reviewId },
      select: { userId: true },
    });

    if (!review) {
      throw new NotFoundException(
        `No se encontró la reseña con ID ${reviewId}`,
      );
    }

    if (review.userId === userId) {
      throw new BadRequestException(
        'No puedes marcar como útil tu propia reseña',
      );
    }

    await this.prisma.client.reviewHelpfulVote.upsert({
      where: { reviewId_userId: { reviewId, userId } },
      update: {},
      create: { reviewId, userId },
    });

    return this.getHelpfulSummary(reviewId, userId);
  }

  async unmarkHelpful(reviewId: string, userId: string) {
    try {
      await this.prisma.client.reviewHelpfulVote.delete({
        where: { reviewId_userId: { reviewId, userId } },
      });
    } catch (error) {
      translatePrismaError(error, {
        // Two concurrent "quitar útil" clicks (double-click, two tabs) can
        // both pass a check-then-act race; the second one targets an
        // already-gone row. Same shape as FavoritesService#removeFavorite.
        P2025: () => {
          throw new NotFoundException('No has marcado esta reseña como útil');
        },
      });
    }

    return this.getHelpfulSummary(reviewId, userId);
  }

  private async getHelpfulSummary(reviewId: string, userId: string) {
    const [helpfulCount, myVote] = await Promise.all([
      this.prisma.client.reviewHelpfulVote.count({ where: { reviewId } }),
      this.prisma.client.reviewHelpfulVote.findUnique({
        where: { reviewId_userId: { reviewId, userId } },
        select: { id: true },
      }),
    ]);

    return { helpfulCount, votedByMe: !!myVote };
  }

  async remove(id: string, userId: string, role: Role) {
    const review = await this.prisma.client.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException(`No se encontró la reseña con ID ${id}`);
    }

    if (review.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para eliminar esta reseña',
      );
    }

    return this.prisma.client.review.delete({ where: { id } });
  }

  async getAllReviews(query: any) {
    const { page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

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
