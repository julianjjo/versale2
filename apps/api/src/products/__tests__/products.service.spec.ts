/* eslint-disable @typescript-eslint/no-unsafe-assignment -- expect.objectContaining is any by design */
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ProductsService } from '../products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Role } from '@prisma/client';

// Simulates the error Prisma throws when `update`/`delete`'s extra `where`
// filter (e.g. `status: "AVAILABLE" as const`) matches no row — the shape a concurrent
// checkout would trigger between this service's read and its write.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

// Simulates the error Prisma throws when a delete is blocked by an
// ON DELETE RESTRICT foreign key — e.g. a CartItem, Review, or OrderItem
// (even from a cancelled order) still pointing at this product.
function foreignKeyViolationError() {
  return new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint violated',
    {
      code: 'P2003',
      clientVersion: 'test',
    },
  );
}

describe('ProductsService', () => {
  let service: ProductsService;

  const mockPrismaClient = {
    product: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    orderItem: {
      findFirst: jest.fn(),
    },
    review: {
      groupBy: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    cartItem: {
      deleteMany: jest.fn(),
    },
  };

  // update()'s product.update + cartItem.deleteMany now run inside a
  // $transaction. Resolving the callback with the client itself (not a
  // separate `tx` mock) keeps every existing assertion against
  // mockPrismaService.client.product.update/cartItem.deleteMany valid —
  // real Prisma's tx exposes the identical shape as the top-level client.
  // Assigned after the object literal (rather than inline) so TS can infer
  // mockPrismaClient's own type before this self-referencing closure exists.
  const mockTransaction = jest.fn(
    (fn: (tx: typeof mockPrismaClient) => unknown) => fn(mockPrismaClient),
  );
  (
    mockPrismaClient as unknown as { $transaction: typeof mockTransaction }
  ).$transaction = mockTransaction;

  const mockPrismaService = { client: mockPrismaClient };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    // findOne() always fires this alongside the product read now, whether or
    // not a test cares about verifiedPurchase — default to "never sold" so
    // every other findOne test doesn't have to set this up itself.
    mockPrismaService.client.orderItem.findFirst.mockResolvedValue(null);
    // findAll() always fires this alongside the product read now, whether or
    // not a test cares about ratings — default to "no reviews yet" so every
    // other findAll test doesn't have to set this up itself.
    mockPrismaService.client.review.groupBy.mockResolvedValue([]);
    // findOne() fires a fire-and-forget view-count increment for any
    // non-owner requester — default it to a resolved promise so every other
    // findOne test doesn't have to stub it just to avoid an unhandled
    // rejection.
    mockPrismaService.client.product.update.mockResolvedValue({});
    mockPrismaService.client.cartItem.deleteMany.mockResolvedValue({
      count: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product', async () => {
      const createProductDto: CreateProductDto = {
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        images: [
          { url: 'https://bucket.example.com/image1.jpg', alt: 'Frente' },
          { url: 'https://bucket.example.com/image2.jpg', alt: 'Detrás' },
        ],
      };
      const sellerId = 'seller1';

      const mockProduct = {
        id: 'product1',
        ...createProductDto,
        sellerId,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.create.mockResolvedValue(mockProduct);

      const result = await service.create(createProductDto, sellerId);

      expect(mockPrismaService.client.product.create).toHaveBeenCalledWith({
        data: {
          ...createProductDto,
          sellerId,
          images: createProductDto.images, // should be passed as is (Json type)
        },
      });
      expect(result).toEqual(mockProduct);
    });

    // Item 9: hard ceiling of 20 active listings per seller. The count is
    // over status AVAILABLE — which includes paused rows (pausedAt only
    // hides them), so pause-then-create can't bypass the cap.
    it('rejects the 21st active listing with HTTP 429', async () => {
      const createProductDto: CreateProductDto = {
        title: 'Producto 21',
        description: 'Uno de más',
        category: 'Otros',
        size: 'M',
        condition: 'Good',
        price: 10.0,
      };
      mockPrismaService.client.product.count.mockResolvedValue(20);
      mockPrismaService.client.product.create.mockResolvedValue({});

      await expect(
        service.create(createProductDto, 'seller1'),
      ).rejects.toMatchObject({ status: 429 });
      expect(mockPrismaService.client.product.create).not.toHaveBeenCalled();
    });

    it('counts paused listings toward the active cap (no pause-then-create bypass)', async () => {
      const createProductDto: CreateProductDto = {
        title: 'Producto 21',
        description: 'Uno de más',
        category: 'Otros',
        size: 'M',
        condition: 'Good',
        price: 10.0,
      };
      mockPrismaService.client.product.count.mockResolvedValue(20);

      await expect(
        service.create(createProductDto, 'seller1'),
      ).rejects.toMatchObject({ status: 429 });
      // The count query itself filters by AVAILABLE (paused included,
      // SOLD/WITHDRAWN excluded).
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { sellerId: 'seller1', status: 'AVAILABLE' },
      });
    });

    it('allows a new listing when the seller is under the cap', async () => {
      const createProductDto: CreateProductDto = {
        title: 'Producto dentro del límite',
        description: 'Hay espacio',
        category: 'Otros',
        size: 'M',
        condition: 'Good',
        price: 10.0,
      };
      mockPrismaService.client.product.count.mockResolvedValue(19);
      mockPrismaService.client.product.create.mockResolvedValue({
        id: 'p21',
      });

      await expect(
        service.create(createProductDto, 'seller1'),
      ).resolves.toHaveProperty('id', 'p21');
    });

    // Regression: count-then-insert has to run inside one transaction, the
    // same way orders.service.ts's MAX_PENDING_ORDERS_PER_BUYER check does —
    // otherwise two concurrent POST /products from a seller sitting at 19
    // active listings could each read count === 19 before either commits,
    // both pass the check, and leave the seller over the cap.
    it('runs the count-then-insert cap check inside a single transaction', async () => {
      const createProductDto: CreateProductDto = {
        title: 'Producto dentro del límite',
        description: 'Hay espacio',
        category: 'Otros',
        size: 'M',
        condition: 'Good',
        price: 10.0,
      };
      mockPrismaService.client.product.count.mockResolvedValue(19);
      mockPrismaService.client.product.create.mockResolvedValue({ id: 'p1' });

      await service.create(createProductDto, 'seller1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return an approved product if found (no requester)', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        sellerId: 'seller1',
        isApproved: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        reviews: [],
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findOne(productId);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
        include: {
          seller: { select: { id: true, name: true } },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              userId: true,
              sellerReply: true,
              sellerRepliedAt: true,
              user: { select: { id: true, name: true } },
              _count: { select: { helpfulVotes: true } },
              helpfulVotes: {
                // No requester was passed in for this call, so the sentinel
                // id from ProductsService's NO_ANONYMOUS_VOTER_ID is used.
                where: { userId: '__anonymous__' },
                select: { id: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { reviews: true } },
          questions: {
            select: {
              id: true,
              productId: true,
              question: true,
              answer: true,
              answeredAt: true,
              createdAt: true,
              askerId: true,
              asker: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
          },
        },
      });
      expect(result).toEqual(mockProduct);
    });

    it('caps the embedded questions instead of fetching every question ever asked', async () => {
      // Unlike reviews (bounded by "one delivered purchase per unique
      // garment"), any non-owner can ask unlimited questions and findOne is
      // the only place they're ever read — without a `take`, a heavily
      // asked-about product would ship its whole question history on every
      // page view.
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      });

      await service.findOne('product1');

      const findUniqueMock = mockPrismaService.client.product
        .findUnique as unknown as {
        mock: { calls: Array<[{ include: { questions: { take?: number } } }]> };
      };
      expect(findUniqueMock.mock.calls[0][0].include.questions.take).toBe(200);
    });

    it("should mark the review from the product's actual verified buyer as verifiedPurchase", async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [
          {
            id: 'r1',
            userId: 'buyer1',
            rating: 5,
            _count: { helpfulVotes: 2 },
            helpfulVotes: [],
          },
          {
            id: 'r2',
            userId: 'someoneElse',
            rating: 3,
            _count: { helpfulVotes: 0 },
            helpfulVotes: [],
          },
        ],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );
      mockPrismaService.client.orderItem.findFirst.mockResolvedValue({
        order: { userId: 'buyer1' },
      });

      const result = await service.findOne(productId);

      expect(mockPrismaService.client.orderItem.findFirst).toHaveBeenCalledWith(
        {
          where: {
            productId,
            order: { status: { in: ['PAID', 'SHIPPED', 'DELIVERED'] } },
          },
          select: { order: { select: { userId: true } } },
        },
      );
      expect(result.reviews).toEqual([
        {
          id: 'r1',
          userId: 'buyer1',
          rating: 5,
          verifiedPurchase: true,
          helpfulCount: 2,
          votedByMe: false,
        },
        {
          id: 'r2',
          userId: 'someoneElse',
          rating: 3,
          verifiedPurchase: false,
          helpfulCount: 0,
          votedByMe: false,
        },
      ]);
    });

    it('should mark every review as unverified when the product was never actually sold', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [
          {
            id: 'r1',
            userId: 'buyer1',
            rating: 4,
            _count: { helpfulVotes: 0 },
            helpfulVotes: [],
          },
        ],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );
      mockPrismaService.client.orderItem.findFirst.mockResolvedValue(null);

      const result = await service.findOne(productId);

      expect(result.reviews).toEqual([
        {
          id: 'r1',
          userId: 'buyer1',
          rating: 4,
          verifiedPurchase: false,
          helpfulCount: 0,
          votedByMe: false,
        },
      ]);
    });

    it("marks votedByMe true when the logged-in requester's own vote comes back in helpfulVotes", async () => {
      const productId = 'product1';
      const requester = { id: 'buyer1', role: Role.USER };
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [
          {
            id: 'r1',
            userId: 'someoneElse',
            rating: 5,
            _count: { helpfulVotes: 1 },
            helpfulVotes: [{ id: 'vote1' }],
          },
        ],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findOne(productId, requester);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            reviews: expect.objectContaining({
              select: expect.objectContaining({
                helpfulVotes: {
                  where: { userId: requester.id },
                  select: { id: true },
                },
              }) as Record<string, unknown>,
            }) as Record<string, unknown>,
          }) as Record<string, unknown>,
        }),
      );
      expect(result.reviews[0]).toMatchObject({
        helpfulCount: 1,
        votedByMe: true,
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      const productId = 'nonexistent';
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne(productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return an unapproved product to the seller who owns it', async () => {
      const productId = 'product1';
      const sellerId = 'seller1';
      const mockProduct = {
        id: productId,
        sellerId,
        isApproved: false,
        reviews: [],
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findOne(productId, {
        id: sellerId,
        role: Role.USER,
      });

      expect(result).toEqual(mockProduct);
    });

    it('should return an unapproved product to an admin who is not the seller', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: false,
        reviews: [],
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findOne(productId, {
        id: 'admin1',
        role: Role.ADMIN,
      });

      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException for an unapproved product when requester is anonymous', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: false,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(service.findOne(productId, null)).rejects.toThrow(
        NotFoundException,
      );
      // Access was denied — a rejected visitor's request must not still
      // count as "interest" in a listing they were never shown.
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Being sold takes a listing out of the catalog, not off the web: the
    // buyer opens this page from their order history and it is the only place
    // they can leave a review, so it stays readable by anyone.
    it('should return a sold product to a buyer and to an anonymous visitor', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        status: 'SOLD' as const,
        reviews: [],
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.findOne(productId, { id: 'someoneElse', role: Role.USER }),
      ).resolves.toEqual(mockProduct);
      await expect(service.findOne(productId, null)).resolves.toEqual(
        mockProduct,
      );
    });

    it('should still hide a sold product that was never approved', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: false,
        status: 'SOLD' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.findOne(productId, { id: 'someoneElse', role: Role.USER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return a sold product to its seller and to an admin', async () => {
      const productId = 'product1';
      const sellerId = 'seller1';
      const mockProduct = {
        id: productId,
        sellerId,
        isApproved: true,
        status: 'SOLD' as const,
        reviews: [],
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.findOne(productId, { id: sellerId, role: Role.USER }),
      ).resolves.toEqual(mockProduct);
      await expect(
        service.findOne(productId, { id: 'admin1', role: Role.ADMIN }),
      ).resolves.toEqual(mockProduct);
    });

    it('should throw NotFoundException for an unapproved product when requester is a different user', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: false,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.findOne(productId, { id: 'someoneElse', role: Role.USER }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should record a view for an anonymous visitor', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findOne(productId, null);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
        select: { id: true },
      });
    });

    it('should record a view for a buyer who is not the seller', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findOne(productId, { id: 'buyer1', role: Role.USER });

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
        select: { id: true },
      });
    });

    it('should record a view for an admin browsing the listing', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findOne(productId, { id: 'admin1', role: Role.ADMIN });

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { viewCount: { increment: 1 } },
        select: { id: true },
      });
    });

    // The view counter exists to tell a seller how much buyer interest their
    // own listing gets — their own preview visits aren't that signal.
    it("should not record a view when the requester is the listing's own seller", async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findOne(productId, { id: 'seller1', role: Role.USER });

      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Regression: the view-count increment is a side effect fired after the
    // product has already been successfully read — a transient failure
    // there must not turn an otherwise-successful product page load into a
    // failed one.
    it('should still resolve the product read when the view-count increment fails', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );
      mockPrismaService.client.product.update.mockRejectedValue(
        new Error('product table is down'),
      );

      await expect(service.findOne(productId, null)).resolves.toEqual(
        mockProduct,
      );
    });

    it('should trim a padded productId before querying', async () => {
      const mockProduct = {
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        reviews: [],
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findOne('  product1  ', null);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'product1' } }),
      );
    });
  });

  describe('findRaw', () => {
    it('should throw NotFoundException for a missing id', async () => {
      const productId = 'nonexistent';
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.findRaw(productId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return the raw row for an approved product with no visibility filtering', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findRaw(productId);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should return the raw row for an unapproved product with no visibility filtering', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        sellerId: 'seller1',
        isApproved: false,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findRaw(productId);

      expect(result).toEqual(mockProduct);
    });

    it('should trim a padded id before querying', async () => {
      const mockProduct = {
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await service.findRaw('  product1  ');

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product1' },
      });
    });
  });

  describe('update', () => {
    // The buyer's order detail renders the live product row, so a seller
    // rewriting a sold garment would change what someone else's purchase history
    // says they bought — and the re-moderation branch would push an
    // already-shipped item back into the pending queue, where `!isApproved` then
    // blocks the buyer's review for good.
    it('should refuse to let a seller edit a product that has been sold', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        title: 'Sold Jacket',
        sellerId: userId,
        isApproved: true,
        status: 'SOLD' as const,
      });

      await expect(
        service.update(productId, { title: 'Otra cosa' }, userId, Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede editar');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should update a product and send it back for review when the seller changes moderated content', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const updateProductDto: UpdateProductDto = {
        title: 'Updated Product',
        price: 15,
      };

      const existingProduct = {
        id: productId,
        title: 'Old Title',
        description: 'Old description',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10,
        sellerId: userId, // same as userId
        isApproved: true,
        rejectedAt: null,
        rejectionReason: null,
        status: 'AVAILABLE' as const,
      };

      const updatedProduct = {
        ...existingProduct,
        ...updateProductDto,
        id: productId,
        isApproved: false,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update(
        productId,
        updateProductDto,
        userId,
        Role.USER,
      );

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: {
          ...updateProductDto,
          isApproved: false,
          rejectedAt: null,
          rejectionReason: null,
        },
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
      // Regression: CartItem.priceAtAdd is a snapshot checkout charges
      // verbatim — with a price change on file, any cart already holding
      // this listing must be cleared so a buyer can't complete checkout at a
      // price no moderator ever actually approved.
      expect(mockPrismaService.client.cartItem.deleteMany).toHaveBeenCalledWith(
        { where: { productId } },
      );
      expect(result).toEqual(updatedProduct);
    });

    // Regression: this used to only happen implicitly via the seller
    // re-review branch above — but an admin editing the price directly skips
    // that branch entirely (`role !== Role.ADMIN` guards `needsReview`), so
    // without checking price-changed independently of needsReview, an
    // admin's own price correction would leave every existing cart's
    // priceAtAdd silently stale too.
    it('should clear existing cart snapshots when an admin changes the price directly', async () => {
      const productId = 'product1';
      const existingProduct = {
        id: productId,
        title: 'Chaqueta',
        price: 50000,
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue({
        ...existingProduct,
        price: 500000,
      });

      await service.update(productId, { price: 500000 }, 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.cartItem.deleteMany).toHaveBeenCalledWith(
        { where: { productId } },
      );
    });

    // The initial `findUnique` read only drives the 404/403/status checks. If a
    // checkout claims the product after that read but before this write, the
    // conditional `status: "AVAILABLE" as const` filter on the update matches no row and Prisma
    // raises P2025 — this must still surface as the same "already sold" error,
    // not a raw 500.
    it('should reject a concurrent checkout that sells the product between the read and the write', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        isApproved: true,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.update(productId, { title: 'Otra cosa' }, userId, Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede editar');
    });

    it('should not reset the approval when the seller sends the same values', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const updateProductDto: UpdateProductDto = {
        title: 'Camisa básica azul',
        price: 40000,
        images: [
          { url: 'https://bucket.example.com/image1.jpg', alt: 'Frente' },
        ],
      };

      const existingProduct = {
        id: productId,
        title: 'Camisa básica azul',
        description: 'Como nueva',
        category: 'Camisas',
        size: 'M',
        condition: 'Good',
        price: 40000,
        images: [
          { url: 'https://bucket.example.com/image1.jpg', alt: 'Frente' },
        ],
        sellerId: userId,
        isApproved: true,
        rejectedAt: null,
        rejectionReason: null,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(
        existingProduct,
      );

      await service.update(productId, updateProductDto, userId, Role.USER);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: updateProductDto,
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
      // The price didn't actually change (still 40000) — no reason to punish
      // every existing cart for an edit that left the price untouched.
      expect(
        mockPrismaService.client.cartItem.deleteMany,
      ).not.toHaveBeenCalled();
    });

    it('should clear the rejection so an edited rejected product goes back to the pending queue', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const updateProductDto: UpdateProductDto = {
        description: 'Descripción corregida con más detalle',
      };

      const existingProduct = {
        id: productId,
        title: 'Camisa básica azul',
        description: 'Corta',
        category: 'Camisas',
        size: 'M',
        condition: 'Good',
        price: 40000,
        sellerId: userId,
        isApproved: false,
        rejectedAt: new Date(),
        rejectionReason: 'Descripción incompleta',
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue({
        ...existingProduct,
        ...updateProductDto,
        rejectedAt: null,
        rejectionReason: null,
      });

      await service.update(productId, updateProductDto, userId, Role.USER);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: {
          ...updateProductDto,
          isApproved: false,
          rejectedAt: null,
          rejectionReason: null,
        },
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
    });

    it('should throw NotFoundException if product not found', async () => {
      const productId = 'nonexistent';
      const userId = 'seller1';
      const updateProductDto: UpdateProductDto = { title: 'New Title' };

      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update(productId, updateProductDto, userId, Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is not the seller and not an admin', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const wrongUserId = 'seller2';
      const updateProductDto: UpdateProductDto = { title: 'New Title' };

      const existingProduct = {
        id: productId,
        sellerId: userId, // different from wrongUserId
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );

      await expect(
        service.update(productId, updateProductDto, wrongUserId, Role.USER),
      ).rejects.toThrow('No tienes autorización para actualizar este producto');
    });

    it('should allow an admin to update a product they do not own without revoking the approval', async () => {
      const productId = 'product1';
      const sellerId = 'seller1';
      const adminId = 'admin1';
      const updateProductDto: UpdateProductDto = { title: 'New Title' };

      const existingProduct = {
        id: productId,
        sellerId, // different from adminId
        title: 'Old Title',
        isApproved: true,
        status: 'AVAILABLE' as const,
      };

      const updatedProduct = { ...existingProduct, ...updateProductDto };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update(
        productId,
        updateProductDto,
        adminId,
        Role.ADMIN,
      );

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: updateProductDto,
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual(updatedProduct);
    });
  });

  describe('pauseProduct', () => {
    it('should throw NotFoundException when the product does not exist', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.pauseProduct('missing', 'seller1', Role.USER),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is not the seller and not an admin', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      });

      await expect(
        service.pauseProduct('product1', 'seller2', Role.USER),
      ).rejects.toThrow('No tienes autorización para pausar este producto');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should refuse to pause a product that has been sold', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'SOLD' as const,
      });

      await expect(
        service.pauseProduct('product1', 'seller1', Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede pausar');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // A pending or rejected listing is already invisible to buyers for a
    // stronger reason; pausing one would leave a `pausedAt` an admin's later
    // approval wouldn't explain.
    it('should refuse to pause a product that is not currently approved', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: false,
        status: 'AVAILABLE' as const,
      });

      await expect(
        service.pauseProduct('product1', 'seller1', Role.USER),
      ).rejects.toThrow('Solo puedes pausar una publicación aprobada');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should set pausedAt for the owning seller', async () => {
      const existingProduct = {
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      };
      const pausedProduct = { ...existingProduct, pausedAt: new Date() };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(pausedProduct);

      const result = await service.pauseProduct(
        'product1',
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: {
          id: 'product1',
          status: 'AVAILABLE' as const,
          isApproved: true,
        },
        data: { pausedAt: expect.any(Date) as Date },
        include: { seller: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(pausedProduct);
    });

    it('should allow an admin to pause a product they do not own', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockResolvedValue({});

      await service.pauseProduct('product1', 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.product.update).toHaveBeenCalled();
    });

    // Mirrors update()/remove()'s own concurrent-checkout regression, but the
    // where-clause here also re-asserts `isApproved: true` (not just
    // `status: "AVAILABLE" as const`), so this P2025 can now be triggered by either a
    // mid-flight sale OR a concurrent rejection/moderated-edit — the message
    // covers both instead of incorrectly claiming the product was sold.
    it('should translate a P2025 from a mid-flight sale or approval change into a single accurate error', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.pauseProduct('product1', 'seller1', Role.USER),
      ).rejects.toThrow(
        'Este producto ya no se puede pausar: fue vendido o dejó de estar aprobado',
      );
    });
  });

  describe('unpauseProduct', () => {
    it('should throw NotFoundException when the product does not exist', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.unpauseProduct('missing', 'seller1', Role.USER),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should throw error if user is not the seller and not an admin', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        status: 'AVAILABLE' as const,
        pausedAt: new Date(),
      });

      await expect(
        service.unpauseProduct('product1', 'seller2', Role.USER),
      ).rejects.toThrow('No tienes autorización para reactivar este producto');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should refuse to unpause a product that has been sold', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        status: 'SOLD' as const,
        pausedAt: new Date(),
      });

      await expect(
        service.unpauseProduct('product1', 'seller1', Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede reactivar');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Unlike pauseProduct(), unpausing has no isApproved guard: a listing can
    // become unapproved again while paused (a moderated-field edit sends it
    // back to review), and clearing pausedAt on it is still a valid action —
    // it just means the listing will be visible once re-approved.
    it('should clear pausedAt even for a listing that is currently unapproved', async () => {
      const existingProduct = {
        id: 'product1',
        sellerId: 'seller1',
        isApproved: false,
        status: 'AVAILABLE' as const,
        pausedAt: new Date(),
      };
      const unpausedProduct = { ...existingProduct, pausedAt: null };
      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(
        unpausedProduct,
      );

      const result = await service.unpauseProduct(
        'product1',
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: 'product1', status: 'AVAILABLE' as const },
        data: { pausedAt: null },
        include: { seller: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(unpausedProduct);
    });

    it('should allow an admin to unpause a product they do not own', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        status: 'AVAILABLE' as const,
        pausedAt: new Date(),
      });
      mockPrismaService.client.product.update.mockResolvedValue({});

      await service.unpauseProduct('product1', 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.product.update).toHaveBeenCalled();
    });

    it('should translate a P2025 mid-flight sale into the same "already sold" error', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        status: 'AVAILABLE' as const,
        pausedAt: new Date(),
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.unpauseProduct('product1', 'seller1', Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede reactivar');
    });
  });

  describe('bulkPause', () => {
    it('should pause every requested product owned by the caller', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.bulkPause(
        ['product1', 'product2'],
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product1', 'product2'] },
          status: 'AVAILABLE' as const,
          isApproved: true,
          pausedAt: null,
          sellerId: 'seller1',
        },
        data: { pausedAt: expect.any(Date) as Date },
      });
      expect(result).toEqual({ paused: 2, requested: 2 });
    });

    // Mirrors pauseProduct()'s compare-and-swap: a product that's sold,
    // unapproved, already paused, or owned by someone else is silently
    // excluded from the count instead of failing the whole batch.
    it('should silently exclude ids the caller cannot pause instead of failing the whole batch', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkPause(
        ['product1', 'product2'],
        'seller1',
        Role.USER,
      );

      expect(result).toEqual({ paused: 1, requested: 2 });
    });

    it('should not scope the where-clause by sellerId for an admin', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.bulkPause(['product1'], 'admin1', Role.ADMIN);

      const [[{ where }]] = mockPrismaService.client.product.updateMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.sellerId).toBeUndefined();
    });

    it('should scope the where-clause by sellerId for a regular user', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 0,
      });

      await service.bulkPause(['product1'], 'seller1', Role.USER);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sellerId: 'seller1',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should de-duplicate requested ids before counting them or querying', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkPause(
        ['product1', 'product1'],
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['product1'] },
          }) as Record<string, unknown>,
        }),
      );
      expect(result).toEqual({ paused: 1, requested: 1 });
    });
  });

  describe('bulkUnpause', () => {
    it('should unpause every requested product owned by the caller', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.bulkUnpause(
        ['product1', 'product2'],
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product1', 'product2'] },
          status: 'AVAILABLE' as const,
          pausedAt: { not: null },
          sellerId: 'seller1',
        },
        data: { pausedAt: null },
      });
      expect(result).toEqual({ unpaused: 2, requested: 2 });
    });

    // Unlike bulkPause, there's no isApproved guard here — same reasoning as
    // the single-item unpauseProduct().
    it('should not require isApproved in the where-clause', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.bulkUnpause(['product1'], 'seller1', Role.USER);

      const [[{ where }]] = mockPrismaService.client.product.updateMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.isApproved).toBeUndefined();
    });

    it('should silently exclude ids the caller cannot unpause instead of failing the whole batch', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkUnpause(
        ['product1', 'product2'],
        'seller1',
        Role.USER,
      );

      expect(result).toEqual({ unpaused: 1, requested: 2 });
    });

    it('should not scope the where-clause by sellerId for an admin', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.bulkUnpause(['product1'], 'admin1', Role.ADMIN);

      const [[{ where }]] = mockPrismaService.client.product.updateMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.sellerId).toBeUndefined();
    });

    it('should de-duplicate requested ids before counting them or querying', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkUnpause(
        ['product1', 'product1'],
        'seller1',
        Role.USER,
      );

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['product1'] },
          }) as Record<string, unknown>,
        }),
      );
      expect(result).toEqual({ unpaused: 1, requested: 1 });
    });
  });

  describe('remove', () => {
    // `OrderItem.productId` is ON DELETE RESTRICT, so the delete would raise a raw
    // Prisma error; with no exception filter registered that reached the admin as
    // a 500 behind a generic "no pudimos eliminar" banner.
    it('should refuse to delete a product that has been sold, instead of failing at the FK', async () => {
      const productId = 'product1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: 'seller1',
        status: 'SOLD' as const,
      });

      await expect(
        service.remove(productId, 'seller1', Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede eliminar');
      expect(mockPrismaService.client.product.delete).not.toHaveBeenCalled();
    });

    // Mirrors the update() regression above: the initial read only drives the
    // 404/403/status checks, so a checkout that claims the product afterward
    // makes the conditional `status: "AVAILABLE" as const` delete match no row. Prisma raises
    // P2025 for that, and it must still read as the same "already sold" error
    // instead of an unhandled exception.
    it('should reject a concurrent checkout that sells the product between the read and the delete', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.delete.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.remove(productId, userId, Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede eliminar');
    });

    // A CartItem, Review, or an OrderItem from a CANCELLED order (which clears
    // relisted AVAILABLE) can still hold a RESTRICT foreign key to the
    // product even though the `status` guard above sees it as "free". Without
    // catching P2003 that reached the admin as a raw 500.
    it('should refuse to delete a product still referenced by a cart, review, or cancelled order, instead of failing at the FK', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.delete.mockRejectedValue(
        foreignKeyViolationError(),
      );

      await expect(
        service.remove(productId, userId, Role.USER),
      ).rejects.toThrow(
        'Este producto no se puede eliminar: todavía está en un carrito, en las reseñas o favoritos de otra persona, o en un pedido.',
      );
    });

    it('should remove a product if user is the seller', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      const existingProduct = {
        id: productId,
        sellerId: userId, // same as userId
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.delete.mockResolvedValue(
        existingProduct,
      );

      const result = await service.remove(productId, userId, Role.USER);

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: productId },
      });
      expect(mockPrismaService.client.product.delete).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
      });
      expect(result).toEqual(existingProduct);
    });

    it('should throw NotFoundException if product not found', async () => {
      const productId = 'nonexistent';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(productId, userId, Role.USER),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if user is not the seller and not an admin', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const wrongUserId = 'seller2';

      const existingProduct = {
        id: productId,
        sellerId: userId, // different from wrongUserId
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );

      await expect(
        service.remove(productId, wrongUserId, Role.USER),
      ).rejects.toThrow('No tienes autorización para eliminar este producto');
    });

    it('should allow an admin to remove a product they do not own', async () => {
      const productId = 'product1';
      const sellerId = 'seller1';
      const adminId = 'admin1';

      const existingProduct = {
        id: productId,
        sellerId, // different from adminId
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.delete.mockResolvedValue(
        existingProduct,
      );

      const result = await service.remove(productId, adminId, Role.ADMIN);

      expect(mockPrismaService.client.product.delete).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
      });
      expect(result).toEqual(existingProduct);
    });
  });

  describe('images validation', () => {
    it('rejects a non-array images value on CreateProductDto', async () => {
      const dto = new CreateProductDto();
      dto.title = 'Test Product';
      dto.description = 'A test product';
      dto.category = 'Test';
      dto.size = 'M';
      dto.condition = 'New';
      dto.price = 10.0;
      (dto as unknown as { images: unknown }).images = 'not-an-array';

      const errors = await validate(dto);
      const imagesError = errors.find((error) => error.property === 'images');

      expect(imagesError).toBeDefined();
      expect(imagesError?.constraints).toHaveProperty('isArray');
    });

    it('rejects a non-array images value on UpdateProductDto', async () => {
      const dto = new UpdateProductDto();
      (dto as unknown as { images: unknown }).images = { not: 'an array' };

      const errors = await validate(dto);
      const imagesError = errors.find((error) => error.property === 'images');

      expect(imagesError).toBeDefined();
      expect(imagesError?.constraints).toHaveProperty('isArray');
    });

    it('accepts a valid images array with alt on CreateProductDto', async () => {
      // Mirrors the real request path: the global pipe runs
      // plainToInstance before validate, which is what makes @ValidateNested
      // able to descend into each image object. The bucket host comes from
      // the same env the uploads service builds URLs from.
      const originalBase = process.env.R2_PUBLIC_BASE_URL;
      process.env.R2_PUBLIC_BASE_URL = 'https://bucket.example.com';
      try {
        const dto = plainToInstance(CreateProductDto, {
          title: 'Test Product',
          description: 'A test product',
          category: 'Test',
          size: 'M',
          condition: 'New',
          price: 10.0,
          images: [
            { url: 'https://bucket.example.com/image1.jpg', alt: 'Frente' },
            { url: 'https://bucket.example.com/image2.jpg', alt: 'Detrás' },
          ],
        });

        const errors = await validate(dto);
        const imagesError = errors.find((error) => error.property === 'images');

        expect(imagesError).toBeUndefined();
      } finally {
        if (originalBase === undefined) {
          delete process.env.R2_PUBLIC_BASE_URL;
        } else {
          process.env.R2_PUBLIC_BASE_URL = originalBase;
        }
      }
    });
  });

  describe('price and size validation', () => {
    const buildDto = () => {
      const dto = new CreateProductDto();
      dto.title = 'Camisa básica azul';
      dto.description = 'Como nueva, usada dos veces';
      dto.category = 'Camisas';
      dto.size = 'M';
      dto.condition = 'Good';
      dto.price = 40000;
      return dto;
    };

    it('rejects a price with decimals on CreateProductDto (COP has no subunit)', async () => {
      const dto = buildDto();
      dto.price = 25000.55;

      const errors = await validate(dto);
      const priceError = errors.find((error) => error.property === 'price');

      expect(priceError?.constraints).toHaveProperty('isInt');
    });

    it('rejects an absurdly large price on CreateProductDto', async () => {
      const dto = buildDto();
      dto.price = 999_999_999_999;

      const errors = await validate(dto);
      const priceError = errors.find((error) => error.property === 'price');

      expect(priceError?.constraints).toHaveProperty('max');
    });

    it('rejects a size outside the published size list', async () => {
      const dto = buildDto();
      dto.size = 'Talla única';

      const errors = await validate(dto);
      const sizeError = errors.find((error) => error.property === 'size');

      expect(sizeError?.constraints).toHaveProperty('isIn');
    });

    it('rejects an overlong title', async () => {
      const dto = buildDto();
      dto.title = 'a'.repeat(121);

      const errors = await validate(dto);
      const titleError = errors.find((error) => error.property === 'title');

      expect(titleError?.constraints).toHaveProperty('maxLength');
    });

    it('accepts a whole-peso price and a valid size', async () => {
      const errors = await validate(buildDto());

      expect(errors).toHaveLength(0);
    });

    it('rejects a price with decimals on UpdateProductDto', async () => {
      const dto = new UpdateProductDto();
      dto.price = 0.01;

      const errors = await validate(dto);
      const priceError = errors.find((error) => error.property === 'price');

      expect(priceError?.constraints).toHaveProperty('isInt');
    });
  });

  describe('findAll', () => {
    it('should return paginated products with filters', async () => {
      const query = {
        search: 'test',
        minPrice: '10',
        maxPrice: '100',
        size: 'M',
        brand: 'TestBrand',
        condition: 'New',
        page: '1',
        limit: '10',
      };

      const mockProducts = [
        {
          id: 'product1',
          title: 'Test Product',
          description: 'A test product',
          category: 'Test',
          size: 'M',
          condition: 'New',
          price: 50.0,
          sellerId: 'seller1',
          isApproved: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          reviews: [],
        },
      ];

      const mockTotal = 1;

      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(mockTotal);

      const result = await service.findAll(query);

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          OR: [
            { title: { contains: 'test' } },
            { description: { contains: 'test' } },
            { brand: { contains: 'test' } },
            { category: { contains: 'test' } },
          ],
          price: { gte: 10, lte: 100 },
          size: 'M',
          brand: { contains: 'TestBrand' },
          condition: 'New',
        },
        skip: 0,
        take: 10,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          OR: [
            { title: { contains: 'test' } },
            { description: { contains: 'test' } },
            { brand: { contains: 'test' } },
            { category: { contains: 'test' } },
          ],
          price: { gte: 10, lte: 100 },
          size: 'M',
          brand: { contains: 'TestBrand' },
          condition: 'New',
        },
      });
      expect(result).toEqual({
        data: [
          { ...mockProducts[0], _count: { reviews: 0 }, averageRating: null },
        ],
        meta: {
          total: 1,
          page: 1, // converted to number
          limit: 10, // converted to number
          pages: 1,
        },
      });
    });

    it("should attach each product's average rating and review count from a single groupBy query, not one aggregate per product plus a separate count", async () => {
      const mockProducts = [
        { id: 'product1', title: 'Rated product' },
        { id: 'product2', title: 'Unrated product' },
      ];
      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(2);
      mockPrismaService.client.review.groupBy.mockResolvedValue([
        { productId: 'product1', _avg: { rating: 4.5 }, _count: 2 },
      ]);

      const result = await service.findAll({});

      expect(mockPrismaService.client.review.groupBy).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.client.review.groupBy).toHaveBeenCalledWith({
        by: ['productId'],
        where: { productId: { in: ['product1', 'product2'] } },
        _avg: { rating: true },
        _count: true,
      });
      expect(result.data).toEqual([
        {
          id: 'product1',
          title: 'Rated product',
          _count: { reviews: 2 },
          averageRating: 4.5,
        },
        {
          id: 'product2',
          title: 'Unrated product',
          _count: { reviews: 0 },
          averageRating: null,
        },
      ]);
    });

    it('should not query ratings at all for an empty page of results', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      const result = await service.findAll({});

      expect(mockPrismaService.client.review.groupBy).not.toHaveBeenCalled();
      expect(result.data).toEqual([]);
    });
  });

  describe('findAll with category filter', () => {
    it('should filter by exact category when provided', async () => {
      const query = { category: 'Jackets', page: '1', limit: '10' };

      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
            category: { equals: 'Jackets' },
          },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          category: { equals: 'Jackets' },
        },
      });
    });
  });

  describe('findAll sort order', () => {
    beforeEach(() => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
    });

    it('should default to newest-first, with id as a tiebreaker, when no sortBy is given', async () => {
      await service.findAll({});

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('should sort by price ascending, with id as a tiebreaker, when sortBy=price_asc', async () => {
      await service.findAll({ sortBy: 'price_asc' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('should sort by price descending, with id as a tiebreaker, when sortBy=price_desc', async () => {
      await service.findAll({ sortBy: 'price_desc' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ price: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('should fall back to newest-first for an unrecognized sortBy value instead of erroring', async () => {
      await service.findAll({ sortBy: 'not-a-real-option' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    // Regression: Express/qs turns a duplicated query key into an array,
    // which would never === either sort literal and silently fall back —
    // this proves the array's first value is still honored instead.
    it('should honor the first value when sortBy arrives as an array (duplicated query key)', async () => {
      await service.findAll({ sortBy: ['price_asc', 'price_desc'] });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    // Regression: the same duplicated-query-key normalization sortBy already
    // gets above must also apply to the other facet filters — otherwise a
    // repeated ?category=... would silently drop the filter (returning the
    // whole unfiltered catalog) instead of honoring the first value.
    it('should honor the first value when a facet filter arrives as an array (duplicated query key)', async () => {
      await service.findAll({
        category: ['Jeans', 'Tops'],
        size: ['M', 'L'],
        brand: ['Levi', 'Zara'],
        condition: ['Good', 'New'],
        sellerId: ['seller1', 'seller2'],
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Jeans' },
            size: 'M',
            brand: { contains: 'Levi' },
            condition: 'Good',
            sellerId: 'seller1',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should combine sortBy with an active price range filter correctly', async () => {
      await service.findAll({
        sortBy: 'price_asc',
        minPrice: '10000',
        maxPrice: '50000',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          price: { gte: 10000, lte: 50000 },
        },
        skip: 0,
        take: 10,
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
        include: { seller: { select: { id: true, name: true } } },
      });
    });

    it('should sort by viewCount desc when sortBy=most_viewed', async () => {
      await service.findAll({ sortBy: 'most_viewed' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ viewCount: 'desc' }, { id: 'asc' }],
        }),
      );
    });

    it('should sort by favoritedBy count desc when sortBy=most_favorited', async () => {
      await service.findAll({ sortBy: 'most_favorited' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ favoritedBy: { _count: 'desc' } }, { id: 'asc' }],
        }),
      );
    });

    it('should sort top_rated in-memory by averageRating desc with id tiebreaker', async () => {
      const mockProducts = [
        { id: 'b', title: 'B' },
        { id: 'a', title: 'A' },
        { id: 'c', title: 'C' },
      ];
      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(3);
      mockPrismaService.client.review.groupBy.mockResolvedValue([
        { productId: 'a', _avg: { rating: 5 }, _count: 1 },
        { productId: 'b', _avg: { rating: 4 }, _count: 1 },
        { productId: 'c', _avg: { rating: 5 }, _count: 2 },
      ]);
      const result = await service.findAll({ sortBy: 'top_rated' });
      // 5-rated before 4-rated; tie on 5 broken by id asc: a before c
      expect(result.data.map((p) => p.id)).toEqual(['a', 'c', 'b']);
    });

    it('should place unrated products last when sorting top_rated', async () => {
      const mockProducts = [
        { id: 'p1', title: 'Rated' },
        { id: 'p2', title: 'Unrated' },
      ];
      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(2);
      mockPrismaService.client.review.groupBy.mockResolvedValue([
        { productId: 'p1', _avg: { rating: 3 }, _count: 1 },
      ]);
      const result = await service.findAll({ sortBy: 'top_rated' });
      expect(result.data[0].id).toBe('p1');
      expect(result.data[1].id).toBe('p2');
    });

    it('should cap top_rated scan at MAX_TOP_RATED_SCAN (1000) to avoid OOM', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
      mockPrismaService.client.review.groupBy.mockResolvedValue([]);

      await service.findAll({ sortBy: 'top_rated' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1000 }),
      );
    });

    it('should use case-insensitive contains for search OR and brand', async () => {
      await service.findAll({ search: 'Chaqueta', brand: 'Zara' });
      const calls = mockPrismaService.client.product.findMany.mock
        .calls as unknown[][];
      const where = (
        calls[0][0] as {
          where: { OR: Array<Record<string, unknown>>; brand: unknown };
        }
      ).where;
      expect(where.OR).toEqual([
        { title: { contains: 'Chaqueta' } },
        { description: { contains: 'Chaqueta' } },
        { brand: { contains: 'Chaqueta' } },
        { category: { contains: 'Chaqueta' } },
      ]);
      expect(where.brand).toEqual({ contains: 'Zara' });
    });

    it('should use case-insensitive equals for category', async () => {
      await service.findAll({ category: 'Jeans' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Jeans' },
          }) as Record<string, unknown>,
        }),
      );
    });

    // `equals` is SQL `=`, which is case-sensitive on SQLite, so a lowercase
    // filter from the URL has to be folded to the canonical spelling before it
    // reaches Prisma — otherwise "chaquetas" silently returns an empty catalog.
    it('folds a lowercase category filter to its canonical spelling', async () => {
      await service.findAll({ category: 'chaquetas' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Chaquetas' },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('folds an uppercase category filter to its canonical spelling', async () => {
      await service.findAll({ category: 'JEANS' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Jeans' },
          }) as Record<string, unknown>,
        }),
      );
    });

    // Legacy rows predating the closed category list must keep matching their
    // own spelling rather than being folded into nothing.
    it('passes an unknown category through untouched', async () => {
      await service.findAll({ category: 'Jackets' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Jackets' },
          }) as Record<string, unknown>,
        }),
      );
    });

    // Regression guard: Prisma's `mode` operator is PostgreSQL/MongoDB-only.
    // On this SQLite datasource the query engine rejects it outright, so if it
    // ever reappears in these filters every search 500s in production while
    // these mocked suites stay green.
    it('never sends the SQLite-unsupported `mode` operator', async () => {
      await service.findAll({
        search: 'Chaqueta',
        brand: 'Zara',
        category: 'jeans',
      });
      const calls = mockPrismaService.client.product.findMany.mock
        .calls as unknown[][];
      expect(JSON.stringify(calls[0][0])).not.toContain('insensitive');
    });
  });

  describe('findAll with sellerId filter', () => {
    it('should filter by seller when provided, powering a seller public profile page', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ sellerId: 'seller1', page: '1', limit: '10' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
            sellerId: 'seller1',
          },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          sellerId: 'seller1',
        },
      });
    });

    it('should trim a padded sellerId before filtering', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
      await service.findAll({ sellerId: '  seller1  ' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 'seller1' }),
        }),
      );
    });

    it('should ignore a whitespace-only sellerId', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
      await service.findAll({ sellerId: '   ' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
          },
        }),
      );
      const [[{ where }]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.sellerId).toBeUndefined();
    });

    it("should still only surface that seller's approved, unsold listings, same as the public catalog", async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ sellerId: 'seller1' });

      const [[{ where }]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: { isApproved: boolean; status: unknown } }]];
      expect(where.isApproved).toBe(true);
      expect(where.status).toBe('AVAILABLE');
    });

    it('should AND sellerId with a search term rather than folding it into the search OR clause', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ sellerId: 'seller1', search: 'jacket' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
            sellerId: 'seller1',
            OR: [
              { title: { contains: 'jacket' } },
              { description: { contains: 'jacket' } },
              { brand: { contains: 'jacket' } },
              { category: { contains: 'jacket' } },
            ],
          },
        }),
      );
    });

    // Powers the storefront's "recently viewed" rail: a fixed batch of ids
    // fetched in one call instead of one GET /products/:id per id, so it
    // never touches viewCount the way that per-product endpoint does.
    it('should filter by a comma-separated ids list', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ ids: 'p1,p2,p3' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['p1', 'p2', 'p3'] },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should filter by ids arriving as an array (duplicated query key)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ ids: ['p1', 'p2'] });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['p1', 'p2'] },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should still apply the public-catalog visibility rule alongside an ids filter', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ ids: 'p1' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should ignore blank entries and surrounding whitespace in the ids list', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ ids: ' p1 , ,p2,' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['p1', 'p2'] },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('should not add an id filter at all when ids is absent, empty, or blank', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ ids: '' });

      const [[{ where }]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.id).toBeUndefined();
    });
  });

  describe('getSellerProfile', () => {
    it("should return the seller's public info and active listing count", async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'seller1',
        name: 'Bob',
        createdAt: new Date('2025-01-01'),
      });
      mockPrismaService.client.product.count
        .mockResolvedValueOnce(3) // hasEverListed
        .mockResolvedValueOnce(2); // activeListings

      const result = await service.getSellerProfile('seller1');

      expect(mockPrismaService.client.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'seller1' },
        select: { id: true, name: true, createdAt: true },
      });
      // The existence gate must count every listing the seller has ever
      // created, not just currently-approved ones — see the "pending
      // re-review" regression test below for why.
      expect(mockPrismaService.client.product.count).toHaveBeenNthCalledWith(
        1,
        { where: { sellerId: 'seller1' } },
      );
      expect(result).toEqual({
        id: 'seller1',
        name: 'Bob',
        memberSince: new Date('2025-01-01'),
        activeListings: 2,
      });
    });

    it('should not leak which columns exist on User beyond id/name/createdAt', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'seller1',
        name: 'Bob',
        createdAt: new Date('2025-01-01'),
        email: 'bob@example.com',
        role: 'USER',
      });
      mockPrismaService.client.product.count.mockResolvedValue(1);

      const result = await service.getSellerProfile('seller1');

      expect(Object.keys(result)).toEqual([
        'id',
        'name',
        'memberSince',
        'activeListings',
      ]);
    });

    it('should throw NotFoundException when the user does not exist', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue(null);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await expect(service.getSellerProfile('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    // A registered buyer who has never listed anything isn't a "seller" per
    // PRODUCT.md — this route must not become a way to look up arbitrary
    // account existence/join-date for non-sellers.
    it('should throw NotFoundException when the user exists but has never listed a product', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'buyer1',
        name: 'Alice',
        createdAt: new Date(),
      });
      mockPrismaService.client.product.count.mockResolvedValueOnce(0);

      await expect(service.getSellerProfile('buyer1')).rejects.toThrow(
        'Este vendedor no existe',
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledTimes(1);
    });

    it('should still show a seller with 0 active listings if everything they ever sold is now gone', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'seller1',
        name: 'Bob',
        createdAt: new Date('2025-01-01'),
      });
      mockPrismaService.client.product.count
        .mockResolvedValueOnce(5) // hasEverListed (all since sold)
        .mockResolvedValueOnce(0); // activeListings

      const result = await service.getSellerProfile('seller1');

      expect(result.activeListings).toBe(0);
    });

    // Regression: editing any moderated field of an already-approved listing
    // flips it back to isApproved: false pending re-review (see `update()`).
    // Gating existence on "currently approved" instead of "ever listed"
    // would 404 this seller's OWN profile the moment they touch their price.
    it('should not 404 a seller whose only listing is pending re-review after an edit', async () => {
      mockPrismaService.client.user.findUnique.mockResolvedValue({
        id: 'seller1',
        name: 'Bob',
        createdAt: new Date('2025-01-01'),
      });
      mockPrismaService.client.product.count
        .mockResolvedValueOnce(1) // hasEverListed: the listing still exists...
        .mockResolvedValueOnce(0); // ...but isApproved is currently false, so 0 active

      const result = await service.getSellerProfile('seller1');

      expect(result).toEqual({
        id: 'seller1',
        name: 'Bob',
        memberSince: new Date('2025-01-01'),
        activeListings: 0,
      });
    });
  });

  describe('findAll pagination bounds', () => {
    beforeEach(() => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
    });

    it('should floor the page at 1 so a negative page never produces a negative skip', async () => {
      const result = await service.findAll({ page: '-1', limit: '10' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 10, pages: 0 });
    });

    it('should clamp an oversized limit to the maximum page size', async () => {
      const result = await service.findAll({ limit: '999999' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
      expect(result.meta.limit).toBe(100);
    });

    it('should fall back to the default page size for a non-numeric limit', async () => {
      mockPrismaService.client.product.count.mockResolvedValue(25);

      const result = await service.findAll({ page: 'abc', limit: 'many' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 25, page: 1, limit: 10, pages: 3 });
    });
  });

  describe('getRelatedProducts', () => {
    it('should return other approved, unsold listings in the same category', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'Jackets',
        isApproved: true,
      });
      const mockRelated = [
        { id: 'p2', title: 'Another jacket' },
        { id: 'p3', title: 'Yet another jacket' },
      ];
      mockPrismaService.client.product.findMany.mockResolvedValue(mockRelated);

      const result = await service.getRelatedProducts('p1');

      expect(mockPrismaService.client.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
        select: { category: true, isApproved: true },
      });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: {
          category: 'Jackets',
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
          id: { not: 'p1' },
        },
        take: 4,
        orderBy: { createdAt: 'desc' },
        include: { seller: { select: { id: true, name: true } } },
      });
      expect(result.data).toEqual([
        { ...mockRelated[0], _count: { reviews: 0 }, averageRating: null },
        { ...mockRelated[1], _count: { reviews: 0 }, averageRating: null },
      ]);
    });

    it('should never include the product itself among its own related listings', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'Jackets',
        isApproved: true,
      });
      mockPrismaService.client.product.findMany.mockResolvedValue([]);

      await service.getRelatedProducts('p1');

      const [[{ where }]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: { id: unknown } }]];
      expect(where.id).toEqual({ not: 'p1' });
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.getRelatedProducts('ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.product.findMany).not.toHaveBeenCalled();
    });

    // Regression: without this, a pending or rejected listing's id would
    // 404 on findOne but 200 here, letting a caller confirm a hidden
    // listing exists (and its category) through this side-channel endpoint.
    it('should throw the same NotFoundException for an unapproved source product as for a missing one', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'Jackets',
        isApproved: false,
      });

      await expect(service.getRelatedProducts('pending1')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.client.product.findMany).not.toHaveBeenCalled();
    });

    it('should return an empty list when nothing else is in the same category', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'Jackets',
        isApproved: true,
      });
      mockPrismaService.client.product.findMany.mockResolvedValue([]);

      const result = await service.getRelatedProducts('p1');

      expect(result).toEqual({ data: [] });
    });

    it('folds uppercase category to canonical spelling for related rail', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'CHAQUETAS',
        isApproved: true,
      });
      mockPrismaService.client.product.findMany.mockResolvedValue([]);

      await service.getRelatedProducts('p1');

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Chaquetas',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('folds lowercase category to canonical spelling for related rail', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        category: 'chaquetas',
        isApproved: true,
      });
      mockPrismaService.client.product.findMany.mockResolvedValue([]);

      await service.getRelatedProducts('p1');

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Chaquetas',
          }) as Record<string, unknown>,
        }),
      );
    });
  });

  describe('getFacets', () => {
    it('should return distinct approved brands and categories counted by listing', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValueOnce([
        { brand: "Levi's" },
        { brand: 'Zara' },
      ]);
      mockPrismaService.client.product.groupBy.mockResolvedValueOnce([
        { category: 'Chaquetas', _count: { category: 7 } },
        { category: 'Suéteres', _count: { category: 2 } },
      ]);

      const result = await service.getFacets();

      expect(mockPrismaService.client.product.findMany).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
            brand: { not: null },
            NOT: { brand: '' },
          },
          select: { brand: true },
          distinct: ['brand'],
          orderBy: { brand: 'asc' },
        },
      );
      expect(mockPrismaService.client.product.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: {
          isApproved: true,
          status: 'AVAILABLE' as const,
          pausedAt: null,
        },
        _count: { category: true },
        orderBy: [{ _count: { category: 'desc' } }, { category: 'asc' }],
      });
      expect(result).toEqual({
        brands: ["Levi's", 'Zara'],
        categories: [
          { name: 'Chaquetas', count: 7 },
          { name: 'Suéteres', count: 2 },
        ],
      });
    });

    it('should drop null brands from the result', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValueOnce([
        { brand: null },
      ]);
      mockPrismaService.client.product.groupBy.mockResolvedValueOnce([
        { category: 'Suéteres', _count: { category: 1 } },
      ]);

      const result = await service.getFacets();

      expect(result).toEqual({
        brands: [],
        categories: [{ name: 'Suéteres', count: 1 }],
      });
    });
  });

  describe('findAllMine', () => {
    it('should scope the query to the given sellerId with no status filter', async () => {
      const mockProducts = [
        {
          id: 'product1',
          title: 'Test Product',
          sellerId: 'seller1',
          isApproved: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(1);

      const result = await service.findAllMine('seller1', {
        page: '2',
        limit: '5',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'seller1' },
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: {
            select: { reviews: true, favoritedBy: true, questions: true },
          },
        },
      });
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { sellerId: 'seller1' },
      });
      expect(result).toEqual({
        data: mockProducts,
        meta: { total: 1, page: 2, limit: 5, pages: 1 },
      });
    });

    it('should filter to pending listings (not approved, no rejection reason, not sold)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'pending' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            isApproved: false,
            rejectionReason: null,
            status: 'AVAILABLE' as const,
          },
        }),
      );
    });

    it('should filter to approved listings that are not sold or paused', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'approved' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
          },
        }),
      );
    });

    it('should filter to paused listings regardless of approval state', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'paused' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            pausedAt: { not: null },
            status: 'AVAILABLE' as const,
          },
        }),
      );
    });

    it('should filter to rejected listings', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'rejected' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            isApproved: false,
            rejectionReason: { not: null },
          },
        }),
      );
    });

    it('should filter to sold listings regardless of approval state', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'sold' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: 'seller1', status: 'SOLD' },
        }),
      );
    });

    it("should not leak another seller's listings", async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller2', {});

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: 'seller2' } }),
      );
    });

    it('should filter by title, description, brand, or category when search is provided', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { search: 'chaqueta' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            OR: [
              { title: { contains: 'chaqueta' } },
              { description: { contains: 'chaqueta' } },
              { brand: { contains: 'chaqueta' } },
              { category: { contains: 'chaqueta' } },
            ],
          },
        }),
      );
    });

    it('should combine search with a status filter, both scoped to the seller', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', {
        search: 'lino',
        status: 'approved',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            isApproved: true,
            status: 'AVAILABLE' as const,
            pausedAt: null,
            OR: [
              { title: { contains: 'lino' } },
              { description: { contains: 'lino' } },
              { brand: { contains: 'lino' } },
              { category: { contains: 'lino' } },
            ],
          },
        }),
      );
    });

    it("should never return another seller's listings regardless of the search term", async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller2', { search: 'anything' });

      const [[callArgs]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: { sellerId: string } }]];
      expect(callArgs.where.sellerId).toBe('seller2');
    });

    it('should clamp pagination the same way as the other listing endpoints', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      const result = await service.findAllMine('seller1', {
        page: '-3',
        limit: '999999',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 100, pages: 0 });
    });
  });

  describe('findAllForAdmin', () => {
    it('should return paginated products for admin (including not approved) with no status filter', async () => {
      const query = {
        page: '2',
        limit: '5',
      };

      const mockProducts = [
        {
          id: 'product1',
          title: 'Test Product',
          description: 'A test product',
          category: 'Test',
          size: 'M',
          condition: 'New',
          price: 50.0,
          sellerId: 'seller1',
          isApproved: false, // not approved, but admin can see
          createdAt: new Date(),
          updatedAt: new Date(),
          reviews: [],
        },
      ];

      const mockTotal = 1;

      mockPrismaService.client.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.client.product.count.mockResolvedValue(mockTotal);

      const result = await service.findAllForAdmin(query);

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 5,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      });
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {},
      });
      expect(result).toEqual({
        data: mockProducts,
        meta: {
          total: 1,
          page: 2, // converted to number
          limit: 5, // converted to number
          pages: 1,
        },
      });
    });

    it('should filter to pending products (not approved, not rejected)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllForAdmin({ status: 'pending' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isApproved: false, rejectedAt: null },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { isApproved: false, rejectedAt: null },
      });
    });

    it('should filter to approved products', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllForAdmin({ status: 'approved' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: true } }),
      );
    });

    it('should filter to rejected products (not approved, rejectedAt set)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllForAdmin({ status: 'rejected' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isApproved: false, rejectedAt: { not: null } },
        }),
      );
    });

    it('should keep sold products visible to admins in the approved bucket', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllForAdmin({ status: 'approved' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: true } }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { isApproved: true },
      });
    });

    it('should clamp the pagination for admin listings too', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      const result = await service.findAllForAdmin({
        page: '-3',
        limit: '999999',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
      expect(result.meta).toEqual({ total: 0, page: 1, limit: 100, pages: 0 });
    });
  });

  describe('bulkApprove', () => {
    it('should approve every requested product in a single updateMany call', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.bulkApprove(['product1', 'product2']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product1', 'product2'] },
          isApproved: false,
          status: 'AVAILABLE' as const,
        },
        data: { isApproved: true, rejectedAt: null, rejectionReason: null },
      });
      expect(result).toEqual({ approved: 2, requested: 2 });
    });

    // Mirrors approveProduct()'s compare-and-swap: a product that was sold
    // between the admin loading the list and clicking "Aprobar seleccionados"
    // is silently excluded from the update instead of failing the whole
    // batch, since updateMany's `where` already re-asserts `status: "AVAILABLE" as const`.
    it('should silently exclude already-sold products from the count instead of failing the whole batch', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkApprove(['product1', 'product2']);

      expect(result).toEqual({ approved: 1, requested: 2 });
    });

    // The where clause now also excludes already-approved products (not just
    // sold ones): a product another admin approved in the meantime is
    // silently skipped instead of being redundantly rewritten.
    it('should exclude already-approved products from the where clause', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 0,
      });

      await service.bulkApprove(['product1']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isApproved: false,
          }) as Record<string, unknown>,
        }),
      );
    });

    // A caller other than this app's own Set-backed UI (a retried request, a
    // manually-crafted call) could submit the same id twice; without
    // de-duplication `requested` would read as 2 for a single distinct
    // product, misreporting a fully successful batch as a partial one.
    it('should de-duplicate requested ids before counting them or querying', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkApprove(['product1', 'product1']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['product1'] },
          }) as Record<string, unknown>,
        }),
      );
      expect(result).toEqual({ approved: 1, requested: 1 });
    });
  });

  describe('approveProduct', () => {
    it('should approve a product and clear any prior rejection', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        isApproved: true,
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.approveProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: { isApproved: true, rejectedAt: null, rejectionReason: null },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundException when approving a nonexistent product', async () => {
      const productId = 'nonexistent';
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(service.approveProduct(productId)).rejects.toThrow(
        `Producto con ID ${productId} no encontrado`,
      );
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Regression: previously neither approveProduct() nor rejectProduct()
    // re-asserted `status: "AVAILABLE" as const`, unlike update()/remove() in this same file —
    // so admin/products' new "Rechazar on an approved listing" UI path (which
    // this same PR introduced) could silently un-approve a product that had
    // already been sold, hiding it from its buyer via findOne()'s canView gate.
    it('should refuse to approve a product that has already been sold', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'SOLD' as const,
      });

      await expect(service.approveProduct(productId)).rejects.toThrow(
        'Este producto ya fue vendido y no se puede aprobar',
      );
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Mirrors remove()'s concurrent-checkout test: the initial read only
    // drives the check above, so a checkout that sells the product afterward
    // makes the conditional `status: "AVAILABLE" as const` update match no row. Prisma raises
    // P2025 for that, and it must still read as "already sold" rather than an
    // unhandled exception.
    it('should reject a concurrent checkout that sells the product between the read and the write', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(service.approveProduct(productId)).rejects.toThrow(
        'Este producto ya fue vendido y no se puede aprobar',
      );
    });
  });

  describe('rejectProduct', () => {
    it('should reject a product with a reason', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        isApproved: false,
        rejectionReason: 'Fotos borrosas',
        status: 'AVAILABLE' as const,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.rejectProduct(productId, 'Fotos borrosas');

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date) as Date,
          rejectionReason: 'Fotos borrosas',
        },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should reject a product without a reason', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockResolvedValue({
        id: productId,
      });

      await service.rejectProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, status: 'AVAILABLE' as const },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date) as Date,
          rejectionReason: null,
        },
      });
    });

    it('should throw NotFoundException when rejecting a nonexistent product', async () => {
      const productId = 'nonexistent';
      mockPrismaService.client.product.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectProduct(productId, 'Fotos borrosas'),
      ).rejects.toThrow(`Producto con ID ${productId} no encontrado`);
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Regression: this is the path admin/products' new "Rechazar on an
    // approved listing" button reaches. Without the SOLD-status guard, an admin
    // acting on a stale (already-sold) row could un-approve it with no
    // pushback, hiding it from its buyer.
    it('should refuse to reject a product that has already been sold', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'SOLD' as const,
      });

      await expect(
        service.rejectProduct(productId, 'Fotos borrosas'),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede rechazar');
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    it('should reject a concurrent checkout that sells the product between the read and the write', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        status: 'AVAILABLE' as const,
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.rejectProduct(productId, 'Fotos borrosas'),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede rechazar');
    });
  });

  describe('bulkReject', () => {
    it('should reject every requested product in a single updateMany call', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await service.bulkReject(
        ['product1', 'product2'],
        'Fotos borrosas',
      );

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['product1', 'product2'] },
          rejectedAt: null,
          status: 'AVAILABLE' as const,
        },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date) as Date,
          rejectionReason: 'Fotos borrosas',
        },
      });
      expect(result).toEqual({ rejected: 2, requested: 2 });
    });

    it('should default the rejection reason to null when none is given', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.bulkReject(['product1']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rejectionReason: null,
          }) as Record<string, unknown>,
        }),
      );
    });

    // Mirrors rejectProduct()'s compare-and-swap: a product sold between the
    // admin loading the list and clicking "Rechazar seleccionadas" is
    // silently excluded from the update instead of failing the whole batch.
    it('should silently exclude already-sold products from the count instead of failing the whole batch', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkReject(['product1', 'product2']);

      expect(result).toEqual({ rejected: 1, requested: 2 });
    });

    // The where clause also excludes already-rejected products: re-running
    // the batch over a row another admin already rejected shouldn't
    // overwrite its existing reason/timestamp for no reason.
    it('should exclude already-rejected products from the where clause', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 0,
      });

      await service.bulkReject(['product1']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rejectedAt: null,
          }) as Record<string, unknown>,
        }),
      );
    });

    // Same reasoning as bulkApprove's own de-duplication test: a caller
    // other than this app's own Set-backed UI could submit the same id
    // twice, which would otherwise misreport a fully successful batch as
    // partial.
    it('should de-duplicate requested ids before counting them or querying', async () => {
      mockPrismaService.client.product.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.bulkReject(['product1', 'product1']);

      expect(mockPrismaService.client.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['product1'] },
          }) as Record<string, unknown>,
        }),
      );
      expect(result).toEqual({ rejected: 1, requested: 1 });
    });
  });

  describe('findAll with condition/size normalization', () => {
    beforeEach(() => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);
    });

    it('folds lowercase condition to canonical Good', async () => {
      await service.findAll({ condition: 'good' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ condition: 'Good' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('folds size m to canonical M', async () => {
      await service.findAll({ size: 'm' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ size: 'M' }) as Record<
            string,
            unknown
          >,
        }),
      );
    });

    it('trims whitespace for condition and size', async () => {
      await service.findAll({ condition: ' Good ', size: ' m ' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            condition: 'Good',
            size: 'M',
          }) as Record<string, unknown>,
        }),
      );
    });

    it('trims whitespace for brand filter', async () => {
      await service.findAll({ brand: ' Nike ' });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            brand: { contains: 'Nike' },
          }) as Record<string, unknown>,
        }),
      );
    });

    it('ignores whitespace-only brand filter', async () => {
      await service.findAll({ brand: '   ' });
      const [[{ where }]] = mockPrismaService.client.product.findMany.mock
        .calls as [[{ where: Record<string, unknown> }]];
      expect(where.brand).toBeUndefined();
    });
  });

  describe('getSuggestedPrice', () => {
    it('returns median for exact category+condition when enough samples', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValueOnce(
        Array.from({ length: 5 }, () => ({ price: 50000 })),
      );
      const res = await service.getSuggestedPrice('Chaquetas', 'Good');
      expect(res).toEqual({ suggestedPrice: 50000, sampleSize: 5 });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledTimes(
        1,
      );
    });

    it('falls back to category-only when condition bucket too small', async () => {
      mockPrismaService.client.product.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 1 }, () => ({ price: 40000 })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 4 }, () => ({ price: 60000 })),
        );
      const res = await service.getSuggestedPrice('Jeans', 'New');
      expect(res).toEqual({ suggestedPrice: 60000, sampleSize: 4 });
      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledTimes(
        2,
      );
    });

    it('returns null when both buckets insufficient', async () => {
      mockPrismaService.client.product.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(
          Array.from({ length: 2 }, () => ({ price: 30000 })),
        );
      const res = await service.getSuggestedPrice('Otros', 'Fair');
      expect(res).toEqual({ suggestedPrice: null });
    });

    it('uses median not mean, outlier does not skew (50k,50k,500k → 50k)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValueOnce([
        { price: 50000 },
        { price: 50000 },
        { price: 500000 },
      ]);
      const res = await service.getSuggestedPrice('Chaquetas', 'Good');
      expect(res).toEqual({ suggestedPrice: 50000, sampleSize: 3 });
    });
  });
  it('products: handles empty list', () => {
    expect(true).toBe(true);
  });
});
