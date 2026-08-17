import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { Role } from '../users/role.enum';

const ASKER_SELECT = { asker: { select: { id: true, name: true } } };

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

    return this.prisma.client.productQuestion.create({
      data: { productId, askerId: userId, question },
      include: ASKER_SELECT,
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

    return this.prisma.client.productQuestion.update({
      where: { id },
      data: { answer, answeredAt: new Date() },
      include: ASKER_SELECT,
    });
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

    return this.prisma.client.productQuestion.delete({ where: { id } });
  }
}
