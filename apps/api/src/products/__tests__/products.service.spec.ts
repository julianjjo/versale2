import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { ProductsService } from '../products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Role } from '../../users/role.enum';

// Simulates the error Prisma throws when `update`/`delete`'s extra `where`
// filter (e.g. `soldAt: null`) matches no row — the shape a concurrent
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
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
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
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService);
    // findOne() always fires this alongside the product read now, whether or
    // not a test cares about verifiedPurchase — default to "never sold" so
    // every other findOne test doesn't have to set this up itself.
    mockPrismaService.client.orderItem.findFirst.mockResolvedValue(null);
    // findAll() always fires this alongside the product read now, whether or
    // not a test cares about ratings — default to "no reviews yet" so every
    // other findAll test doesn't have to set this up itself.
    mockPrismaService.client.review.groupBy.mockResolvedValue([]);
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
        images: ['image1.jpg', 'image2.jpg'],
      };
      const sellerId = 'seller1';

      const mockProduct = {
        id: 'product1',
        ...createProductDto,
        sellerId,
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
          },
        },
      });
      expect(result).toEqual(mockProduct);
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
              }),
            }),
          }),
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(service.findOne(productId, null)).rejects.toThrow(
        NotFoundException,
      );
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
        soldAt: new Date(),
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
        soldAt: new Date(),
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
        soldAt: new Date(),
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      await expect(
        service.findOne(productId, { id: 'someoneElse', role: Role.USER }),
      ).rejects.toThrow(NotFoundException);
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        mockProduct,
      );

      const result = await service.findRaw(productId);

      expect(result).toEqual(mockProduct);
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
        soldAt: new Date(),
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
        where: { id: productId, soldAt: null },
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
      expect(result).toEqual(updatedProduct);
    });

    // The initial `findUnique` read only drives the 404/403/soldAt checks. If a
    // checkout claims the product after that read but before this write, the
    // conditional `soldAt: null` filter on the update matches no row and Prisma
    // raises P2025 — this must still surface as the same "already sold" error,
    // not a raw 500.
    it('should reject a concurrent checkout that sells the product between the read and the write', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        isApproved: true,
        soldAt: null,
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
        images: ['image1.jpg'],
      };

      const existingProduct = {
        id: productId,
        title: 'Camisa básica azul',
        description: 'Como nueva',
        category: 'Camisas',
        size: 'M',
        condition: 'Good',
        price: 40000,
        images: ['image1.jpg'],
        sellerId: userId,
        isApproved: true,
        rejectedAt: null,
        rejectionReason: null,
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.update.mockResolvedValue(
        existingProduct,
      );

      await service.update(productId, updateProductDto, userId, Role.USER);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, soldAt: null },
        data: updateProductDto,
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
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
        where: { id: productId, soldAt: null },
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
        soldAt: null,
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
        soldAt: new Date(),
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
        soldAt: null,
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
        soldAt: null,
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
        where: { id: 'product1', soldAt: null, isApproved: true },
        data: { pausedAt: expect.any(Date) },
        include: { seller: { select: { id: true, name: true } } },
      });
      expect(result).toEqual(pausedProduct);
    });

    it('should allow an admin to pause a product they do not own', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        soldAt: null,
      });
      mockPrismaService.client.product.update.mockResolvedValue({});

      await service.pauseProduct('product1', 'admin1', Role.ADMIN);

      expect(mockPrismaService.client.product.update).toHaveBeenCalled();
    });

    // Mirrors update()/remove()'s own concurrent-checkout regression, but the
    // where-clause here also re-asserts `isApproved: true` (not just
    // `soldAt: null`), so this P2025 can now be triggered by either a
    // mid-flight sale OR a concurrent rejection/moderated-edit — the message
    // covers both instead of incorrectly claiming the product was sold.
    it('should translate a P2025 from a mid-flight sale or approval change into a single accurate error', async () => {
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
        isApproved: true,
        soldAt: null,
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
        soldAt: null,
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
        soldAt: new Date(),
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
        soldAt: null,
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
        where: { id: 'product1', soldAt: null },
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
        soldAt: null,
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
        soldAt: null,
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

  describe('remove', () => {
    // `OrderItem.productId` is ON DELETE RESTRICT, so the delete would raise a raw
    // Prisma error; with no exception filter registered that reached the admin as
    // a 500 behind a generic "no pudimos eliminar" banner.
    it('should refuse to delete a product that has been sold, instead of failing at the FK', async () => {
      const productId = 'product1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: 'seller1',
        soldAt: new Date(),
      });

      await expect(
        service.remove(productId, 'seller1', Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede eliminar');
      expect(mockPrismaService.client.product.delete).not.toHaveBeenCalled();
    });

    // Mirrors the update() regression above: the initial read only drives the
    // 404/403/soldAt checks, so a checkout that claims the product afterward
    // makes the conditional `soldAt: null` delete match no row. Prisma raises
    // P2025 for that, and it must still read as the same "already sold" error
    // instead of an unhandled exception.
    it('should reject a concurrent checkout that sells the product between the read and the delete', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        soldAt: null,
      });
      mockPrismaService.client.product.delete.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.remove(productId, userId, Role.USER),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede eliminar');
    });

    // A CartItem, Review, or an OrderItem from a CANCELLED order (which clears
    // `soldAt` back to null) can still hold a RESTRICT foreign key to the
    // product even though the `soldAt` guard above sees it as "free". Without
    // catching P2003 that reached the admin as a raw 500.
    it('should refuse to delete a product still referenced by a cart, review, or cancelled order, instead of failing at the FK', async () => {
      const productId = 'product1';
      const userId = 'seller1';

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        sellerId: userId,
        soldAt: null,
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
        where: { id: productId, soldAt: null },
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue(
        existingProduct,
      );
      mockPrismaService.client.product.delete.mockResolvedValue(
        existingProduct,
      );

      const result = await service.remove(productId, adminId, Role.ADMIN);

      expect(mockPrismaService.client.product.delete).toHaveBeenCalledWith({
        where: { id: productId, soldAt: null },
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

    it('accepts a valid array of strings for images on CreateProductDto', async () => {
      const dto = new CreateProductDto();
      dto.title = 'Test Product';
      dto.description = 'A test product';
      dto.category = 'Test';
      dto.size = 'M';
      dto.condition = 'New';
      dto.price = 10.0;
      dto.images = ['image1.jpg', 'image2.jpg'];

      const errors = await validate(dto);
      const imagesError = errors.find((error) => error.property === 'images');

      expect(imagesError).toBeUndefined();
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
          soldAt: null,
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
          soldAt: null,
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
            soldAt: null,
            pausedAt: null,
            category: 'Jackets',
          },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          soldAt: null,
          pausedAt: null,
          category: 'Jackets',
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

    it('should combine sortBy with an active price range filter correctly', async () => {
      await service.findAll({
        sortBy: 'price_asc',
        minPrice: '10000',
        maxPrice: '50000',
      });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          soldAt: null,
          pausedAt: null,
          price: { gte: 10000, lte: 50000 },
        },
        skip: 0,
        take: 10,
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
        include: { seller: { select: { id: true, name: true } } },
      });
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
            soldAt: null,
            pausedAt: null,
            sellerId: 'seller1',
          },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          soldAt: null,
          pausedAt: null,
          sellerId: 'seller1',
        },
      });
    });

    it("should still only surface that seller's approved, unsold listings, same as the public catalog", async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ sellerId: 'seller1' });

      const where =
        mockPrismaService.client.product.findMany.mock.calls[0][0].where;
      expect(where.isApproved).toBe(true);
      expect(where.soldAt).toBeNull();
    });

    it('should AND sellerId with a search term rather than folding it into the search OR clause', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAll({ sellerId: 'seller1', search: 'jacket' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isApproved: true,
            soldAt: null,
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
          soldAt: null,
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

      const where =
        mockPrismaService.client.product.findMany.mock.calls[0][0].where;
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
  });

  describe('getFacets', () => {
    it('should return distinct approved brands and categories', async () => {
      mockPrismaService.client.product.findMany
        .mockResolvedValueOnce([{ brand: "Levi's" }, { brand: 'Zara' }])
        .mockResolvedValueOnce([
          { category: 'Jackets' },
          { category: 'Sweaters' },
        ]);

      const result = await service.getFacets();

      expect(mockPrismaService.client.product.findMany).toHaveBeenNthCalledWith(
        1,
        {
          where: {
            isApproved: true,
            soldAt: null,
            pausedAt: null,
            brand: { not: null },
          },
          select: { brand: true },
          distinct: ['brand'],
          orderBy: { brand: 'asc' },
        },
      );
      expect(mockPrismaService.client.product.findMany).toHaveBeenNthCalledWith(
        2,
        {
          where: { isApproved: true, soldAt: null, pausedAt: null },
          select: { category: true },
          distinct: ['category'],
          orderBy: { category: 'asc' },
        },
      );
      expect(result).toEqual({
        brands: ["Levi's", 'Zara'],
        categories: ['Jackets', 'Sweaters'],
      });
    });

    it('should drop null brands from the result', async () => {
      mockPrismaService.client.product.findMany
        .mockResolvedValueOnce([{ brand: null }])
        .mockResolvedValueOnce([{ category: 'Sweaters' }]);

      const result = await service.getFacets();

      expect(result).toEqual({ brands: [], categories: ['Sweaters'] });
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
          _count: { select: { reviews: true } },
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

    it('should filter to pending listings (not approved, not rejected, not sold)', async () => {
      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(0);

      await service.findAllMine('seller1', { status: 'pending' });

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sellerId: 'seller1',
            isApproved: false,
            rejectedAt: null,
            soldAt: null,
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
            soldAt: null,
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
            soldAt: null,
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
            rejectedAt: { not: null },
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
          where: { sellerId: 'seller1', soldAt: { not: null } },
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
            soldAt: null,
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

      const [[callArgs]] = mockPrismaService.client.product.findMany.mock.calls;
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
          soldAt: null,
        },
        data: { isApproved: true, rejectedAt: null, rejectionReason: null },
      });
      expect(result).toEqual({ approved: 2, requested: 2 });
    });

    // Mirrors approveProduct()'s compare-and-swap: a product that was sold
    // between the admin loading the list and clicking "Aprobar seleccionados"
    // is silently excluded from the update instead of failing the whole
    // batch, since updateMany's `where` already re-asserts `soldAt: null`.
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
          where: expect.objectContaining({ isApproved: false }),
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
          where: expect.objectContaining({ id: { in: ['product1'] } }),
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: null,
      });
      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.approveProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, soldAt: null },
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
    // re-asserted `soldAt: null`, unlike update()/remove() in this same file —
    // so admin/products' new "Rechazar on an approved listing" UI path (which
    // this same PR introduced) could silently un-approve a product that had
    // already been sold, hiding it from its buyer via findOne()'s canView gate.
    it('should refuse to approve a product that has already been sold', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: new Date(),
      });

      await expect(service.approveProduct(productId)).rejects.toThrow(
        'Este producto ya fue vendido y no se puede aprobar',
      );
      expect(mockPrismaService.client.product.update).not.toHaveBeenCalled();
    });

    // Mirrors remove()'s concurrent-checkout test: the initial read only
    // drives the check above, so a checkout that sells the product afterward
    // makes the conditional `soldAt: null` update match no row. Prisma raises
    // P2025 for that, and it must still read as "already sold" rather than an
    // unhandled exception.
    it('should reject a concurrent checkout that sells the product between the read and the write', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: null,
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
      };

      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: null,
      });
      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.rejectProduct(productId, 'Fotos borrosas');

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, soldAt: null },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date),
          rejectionReason: 'Fotos borrosas',
        },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should reject a product without a reason', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: null,
      });
      mockPrismaService.client.product.update.mockResolvedValue({
        id: productId,
      });

      await service.rejectProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId, soldAt: null },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date),
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
    // approved listing" button reaches. Without the soldAt guard, an admin
    // acting on a stale (already-sold) row could un-approve it with no
    // pushback, hiding it from its buyer.
    it('should refuse to reject a product that has already been sold', async () => {
      const productId = 'product1';
      mockPrismaService.client.product.findUnique.mockResolvedValue({
        id: productId,
        soldAt: new Date(),
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
        soldAt: null,
      });
      mockPrismaService.client.product.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(
        service.rejectProduct(productId, 'Fotos borrosas'),
      ).rejects.toThrow('Este producto ya fue vendido y no se puede rechazar');
    });
  });
});
