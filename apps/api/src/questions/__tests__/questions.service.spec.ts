import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuestionsService } from '../questions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';
import { Role } from '../../users/role.enum';

describe('QuestionsService', () => {
  let service: QuestionsService;

  const mockPrismaService = {
    client: {
      productQuestion: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a question for the given product and asker', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
      });
      const mockQuestion = {
        id: 'question1',
        productId: 'product1',
        askerId: 'buyer1',
        question: '¿Es talla M o L?',
      };
      mockPrismaService.client.productQuestion.create.mockResolvedValue(
        mockQuestion,
      );

      const result = await service.create(
        'buyer1',
        'product1',
        '¿Es talla M o L?',
      );

      expect(mockProductsService.findRaw).toHaveBeenCalledWith('product1');
      expect(mockPrismaService.client.productQuestion.create).toHaveBeenCalledWith({
        data: {
          productId: 'product1',
          askerId: 'buyer1',
          question: '¿Es talla M o L?',
        },
        include: { asker: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(mockQuestion);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductsService.findRaw.mockRejectedValue(
        new NotFoundException('Producto con ID ghost no encontrado'),
      );

      await expect(
        service.create('buyer1', 'ghost', '¿Pregunta?'),
      ).rejects.toThrow(NotFoundException);
      expect(
        mockPrismaService.client.productQuestion.create,
      ).not.toHaveBeenCalled();
    });

    it('should refuse to let anyone ask about a product that is not approved', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: false,
      });

      await expect(
        service.create('buyer1', 'product1', '¿Pregunta?'),
      ).rejects.toThrow(
        'Este producto no está disponible para preguntas',
      );
      expect(
        mockPrismaService.client.productQuestion.create,
      ).not.toHaveBeenCalled();
    });

    it('should refuse to let a seller ask a question about their own product', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
      });

      await expect(
        service.create('seller1', 'product1', '¿Pregunta?'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('seller1', 'product1', '¿Pregunta?'),
      ).rejects.toThrow(
        'No puedes hacerte una pregunta a ti mismo sobre tu propio producto',
      );
      expect(
        mockPrismaService.client.productQuestion.create,
      ).not.toHaveBeenCalled();
    });
  });

  describe('answer', () => {
    it("should let the product's seller answer a question", async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        product: { sellerId: 'seller1' },
      });
      const answered = {
        id: 'question1',
        answer: 'Es talla M',
        answeredAt: new Date(),
      };
      mockPrismaService.client.productQuestion.update.mockResolvedValue(
        answered,
      );

      const result = await service.answer('question1', 'seller1', 'Es talla M');

      expect(mockPrismaService.client.productQuestion.update).toHaveBeenCalledWith({
        where: { id: 'question1' },
        data: { answer: 'Es talla M', answeredAt: expect.any(Date) },
        include: { asker: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(answered);
    });

    it('should throw NotFoundException when the question does not exist', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.answer('missing', 'seller1', 'Es talla M'),
      ).rejects.toThrow(NotFoundException);
      expect(
        mockPrismaService.client.productQuestion.update,
      ).not.toHaveBeenCalled();
    });

    it('should refuse to let anyone other than the product\'s seller answer', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        product: { sellerId: 'seller1' },
      });

      await expect(
        service.answer('question1', 'seller2', 'Es talla M'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.answer('question1', 'seller2', 'Es talla M'),
      ).rejects.toThrow(
        'Solo el vendedor del producto puede responder esta pregunta',
      );
      expect(
        mockPrismaService.client.productQuestion.update,
      ).not.toHaveBeenCalled();
    });

    // Not even an admin bypasses this — mirrors ReviewsService#replyToReview,
    // which has no ADMIN override either: only the product's own seller
    // speaks for it.
    it('should refuse to let an admin who is not the seller answer', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        product: { sellerId: 'seller1' },
      });

      await expect(
        service.answer('question1', 'admin1', 'Es talla M'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('should let the asker delete their own question', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        askerId: 'buyer1',
      });
      mockPrismaService.client.productQuestion.delete.mockResolvedValue({
        id: 'question1',
      });

      const result = await service.remove('question1', 'buyer1', Role.USER);

      expect(mockPrismaService.client.productQuestion.delete).toHaveBeenCalledWith({
        where: { id: 'question1' },
      });
      expect(result).toEqual({ id: 'question1' });
    });

    it('should let an admin delete any question', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        askerId: 'buyer1',
      });
      mockPrismaService.client.productQuestion.delete.mockResolvedValue({
        id: 'question1',
      });

      await service.remove('question1', 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.productQuestion.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when the question does not exist', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.remove('missing', 'buyer1', Role.USER),
      ).rejects.toThrow(NotFoundException);
      expect(
        mockPrismaService.client.productQuestion.delete,
      ).not.toHaveBeenCalled();
    });

    // Deliberately not the product's seller either — letting a seller delete
    // a buyer's question would let them quietly remove an inconvenient one,
    // the same reasoning ReviewsService#remove already applies to reviews.
    it("should refuse to let the product's seller delete a question they did not ask", async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        askerId: 'buyer1',
      });

      await expect(
        service.remove('question1', 'seller1', Role.USER),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.remove('question1', 'seller1', Role.USER),
      ).rejects.toThrow('No tienes autorización para eliminar esta pregunta');
      expect(
        mockPrismaService.client.productQuestion.delete,
      ).not.toHaveBeenCalled();
    });
  });
});
