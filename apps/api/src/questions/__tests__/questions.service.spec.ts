import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  QuestionsService,
  MAX_QUESTIONS_PER_ASKER_PER_PRODUCT,
} from '../questions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';
import { Role } from '@prisma/client';

// Simulates the error Prisma throws when `update`/`delete`'s where clause
// matches no row — the shape a concurrent delete (a double-click, two tabs,
// or the question's own cascade-deleted product) would trigger.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

// expect.any(Date) llega como `any` al sistema de tipos; este wrapper lo
// entrega tipado Date para los literales de aserción (no-unsafe-assignment).
// Misma convención que orders.service.spec.ts y auth.service.spec.ts.
const anyDate = () => expect.any(Date) as Date;

describe('QuestionsService', () => {
  let service: QuestionsService;

  const mockPrismaClient = {
    productQuestion: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  // create()'s per-asker-per-product cap check runs inside a $transaction.
  // Resolving the callback with the client itself keeps every existing
  // assertion against mockPrismaService.client.productQuestion.* valid.
  const mockTransaction = jest.fn(
    (fn: (tx: typeof mockPrismaClient) => unknown) => fn(mockPrismaClient),
  );
  (
    mockPrismaClient as unknown as { $transaction: typeof mockTransaction }
  ).$transaction = mockTransaction;

  const mockPrismaService = { client: mockPrismaClient };

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
    // Sane default for every create() test below: this asker hasn't asked
    // anything yet, so the new per-asker-per-product cap never trips unless
    // a test deliberately sets it otherwise.
    mockPrismaClient.productQuestion.count.mockResolvedValue(0);
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
      // No `include` — the caller (ProductQuestions) discards this response
      // and refetches the product instead, so joining `asker` here would be
      // a join nobody reads.
      expect(
        mockPrismaService.client.productQuestion.create,
      ).toHaveBeenCalledWith({
        data: {
          productId: 'product1',
          askerId: 'buyer1',
          question: '¿Es talla M o L?',
        },
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
      ).rejects.toThrow('Este producto no está disponible para preguntas');
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

    // Regression: with no ceiling at all, any non-owner could script
    // hundreds of junk questions against one listing — the product page only
    // ever shows the newest MAX_QUESTIONS_PER_PRODUCT, so a flood from one
    // account permanently buries the seller's real Q&A with no self-service
    // cleanup for the seller.
    it('should refuse a new question once this asker already reached the per-product cap', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
      });
      mockPrismaClient.productQuestion.count.mockResolvedValue(
        MAX_QUESTIONS_PER_ASKER_PER_PRODUCT,
      );

      await expect(
        service.create('buyer1', 'product1', 'Otra pregunta más'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaClient.productQuestion.count).toHaveBeenCalledWith({
        where: { productId: 'product1', askerId: 'buyer1' },
      });
      expect(mockPrismaClient.productQuestion.create).not.toHaveBeenCalled();
    });

    it('should count only this asker, not every question on the product, toward the cap', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
      });
      mockPrismaClient.productQuestion.count.mockResolvedValue(
        MAX_QUESTIONS_PER_ASKER_PER_PRODUCT - 1,
      );
      mockPrismaClient.productQuestion.create.mockResolvedValue({
        id: 'question2',
      });

      await expect(
        service.create('buyer1', 'product1', 'Una pregunta más'),
      ).resolves.toHaveProperty('id', 'question2');
    });

    // Regression: count-then-insert has to run inside one transaction, the
    // same way the per-seller active-listings and per-buyer pending-order
    // caps elsewhere in this codebase do.
    it('runs the per-asker cap check inside a single transaction', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
      });
      mockPrismaClient.productQuestion.create.mockResolvedValue({
        id: 'question1',
      });

      await service.create('buyer1', 'product1', '¿Pregunta?');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
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

      expect(
        mockPrismaService.client.productQuestion.update,
      ).toHaveBeenCalledWith({
        where: { id: 'question1' },
        data: { answer: 'Es talla M', answeredAt: anyDate() },
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

    it("should refuse to let anyone other than the product's seller answer", async () => {
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

    // Regression: unlike Review (ON DELETE RESTRICT), ProductQuestion
    // cascades when its product is deleted — the initial read only drives
    // the ownership check above, so a concurrent product delete taking this
    // question with it makes the write below match no row. Prisma raises
    // P2025 for that, and it must read as "question no longer exists"
    // instead of an unhandled 500.
    it('should translate a P2025 from a concurrent delete into a 404', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        product: { sellerId: 'seller1' },
      });
      mockPrismaService.client.productQuestion.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.answer('question1', 'seller1', 'Es talla M'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.answer('question1', 'seller1', 'Es talla M'),
      ).rejects.toThrow('No se encontró la pregunta con ID question1');
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

      expect(
        mockPrismaService.client.productQuestion.delete,
      ).toHaveBeenCalledWith({
        where: { id: 'question1' },
      });
      expect(result).toEqual({ success: true });
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

      expect(
        mockPrismaService.client.productQuestion.delete,
      ).toHaveBeenCalled();
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

    // Regression: a double-click, two open tabs, or another admin dismissing
    // the same question moments earlier all make this delete match no row.
    it('should translate a P2025 from a concurrent delete into a 404', async () => {
      mockPrismaService.client.productQuestion.findUnique.mockResolvedValue({
        id: 'question1',
        askerId: 'buyer1',
      });
      mockPrismaService.client.productQuestion.delete.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.remove('question1', 'buyer1', Role.USER),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.remove('question1', 'buyer1', Role.USER),
      ).rejects.toThrow('No se encontró la pregunta con ID question1');
    });
  });

  describe('getAllForAdmin', () => {
    it('should return paginated questions with asker and product info', async () => {
      const mockQuestions = [
        {
          id: 'question1',
          question: '¿Es talla M?',
          asker: { id: 'buyer1', name: 'Alice' },
          product: { id: 'product1', title: 'Chaqueta' },
        },
      ];
      mockPrismaService.client.productQuestion.findMany.mockResolvedValue(
        mockQuestions,
      );
      mockPrismaService.client.productQuestion.count.mockResolvedValue(1);

      const result = await service.getAllForAdmin({ page: '1', limit: '20' });

      expect(
        mockPrismaService.client.productQuestion.findMany,
      ).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        include: {
          asker: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({
        data: mockQuestions,
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      });
    });

    it('should default to the standard page size when no query is given', async () => {
      mockPrismaService.client.productQuestion.findMany.mockResolvedValue([]);
      mockPrismaService.client.productQuestion.count.mockResolvedValue(0);

      await service.getAllForAdmin(undefined);

      expect(
        mockPrismaService.client.productQuestion.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });
  });
});
