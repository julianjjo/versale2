import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { translatePrismaError } from '../common/prisma-error';
import { resolvePagination } from '../common/pagination';
import { Role } from '../users/role.enum';

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async create(userId: string, productId: string, question: string) {
    const product = await this.productsService.findRaw(productId);

    // Mirrors ReviewsService#create's own visibility gate: a listing no
    // buyer can otherwise find shouldn't be askable about either.
    if (!product.isApproved) {
      throw new BadRequestException(
        'Este producto no está disponible para preguntas',
      );
    }

    if (product.sellerId === userId) {
      throw new BadRequestException(
        'No puedes hacerte una pregunta a ti mismo sobre tu propio producto',
      );
    }

    // No `include` here: the web app discards this response and refetches
    // the product (which embeds questions with its own asker select) via
    // cache invalidation, so joining the asker on every write would be a
    // join nobody reads.
    return this.prisma.client.productQuestion.create({
      data: { productId, askerId: userId, question },
    });
  }

  async answer(id: string, sellerId: string, answer: string) {
    const question = await this.prisma.client.productQuestion.findUnique({
      where: { id },
      include: { product: { select: { sellerId: true } } },
    });

    if (!question) {
      throw new NotFoundException(`No se encontró la pregunta con ID ${id}`);
    }

    // Only the product's own seller answers questions about it — not any
    // seller, and not the asker editing their own question. Mirrors
    // ReviewsService#replyToReview's identical ownership check.
    if (question.product.sellerId !== sellerId) {
      throw new ForbiddenException(
        'Solo el vendedor del producto puede responder esta pregunta',
      );
    }

    try {
      return await this.prisma.client.productQuestion.update({
        where: { id },
        data: { answer, answeredAt: new Date() },
      });
    } catch (error) {
      translatePrismaError(error, {
        // Unlike Review (ON DELETE RESTRICT on its product relation),
        // ProductQuestion cascades when its product is deleted — so the
        // product this question belongs to can vanish between the read
        // above and this write, taking the question with it. Without this,
        // that race surfaced as a raw 500 instead of the same "already
        // gone" 404 every other not-found path in this app returns.
        P2025: () => {
          throw new NotFoundException(
            `No se encontró la pregunta con ID ${id}`,
          );
        },
      });
    }
  }

  async remove(id: string, userId: string, role: Role) {
    const question = await this.prisma.client.productQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`No se encontró la pregunta con ID ${id}`);
    }

    if (question.askerId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para eliminar esta pregunta',
      );
    }

    try {
      await this.prisma.client.productQuestion.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, {
        // Same cascade-delete race as answer() above, plus the more common
        // case of a double-click/two-tab delete of the same question.
        P2025: () => {
          throw new NotFoundException(
            `No se encontró la pregunta con ID ${id}`,
          );
        },
      });
    }

    return { success: true };
  }

  // Read-only admin oversight of this public, unmoderated content — mirrors
  // ReviewsService#getAllReviews exactly. Deleting a question an admin finds
  // here reuses `remove()` above (its ADMIN bypass already covers this).
  async getAllForAdmin(query: any) {
    const { page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const [questions, total] = await Promise.all([
      this.prisma.client.productQuestion.findMany({
        skip,
        take: limitNum,
        include: {
          asker: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.productQuestion.count(),
    ]);

    return {
      data: questions,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }
}
