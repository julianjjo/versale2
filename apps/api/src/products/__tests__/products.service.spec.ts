import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { ProductsService } from '../products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Role } from '../../users/role.enum';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    client: {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
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
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService);
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
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { reviews: true } },
        },
      });
      expect(result).toEqual(mockProduct);
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
        where: { id: productId },
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
        where: { id: productId },
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
        where: { id: productId },
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
        where: { id: productId },
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
        where: { id: productId },
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
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      });
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: {
          isApproved: true,
          soldAt: null,
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
        data: mockProducts,
        meta: {
          total: 1,
          page: 1, // converted to number
          limit: 10, // converted to number
          pages: 1,
        },
      });
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
          where: { isApproved: true, soldAt: null, category: 'Jackets' },
        }),
      );
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { isApproved: true, soldAt: null, category: 'Jackets' },
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

  describe('getFacets', () => {
    it('should return distinct approved brands and categories', async () => {
      mockPrismaService.client.product.findMany
        .mockResolvedValueOnce([{ brand: "Levi's" }, { brand: 'Zara' }])
        .mockResolvedValueOnce([{ category: 'Jackets' }, { category: 'Sweaters' }]);

      const result = await service.getFacets();

      expect(mockPrismaService.client.product.findMany).toHaveBeenNthCalledWith(
        1,
        {
          where: { isApproved: true, soldAt: null, brand: { not: null } },
          select: { brand: true },
          distinct: ['brand'],
          orderBy: { brand: 'asc' },
        },
      );
      expect(mockPrismaService.client.product.findMany).toHaveBeenNthCalledWith(
        2,
        {
          where: { isApproved: true, soldAt: null },
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

  describe('approveProduct', () => {
    it('should approve a product and clear any prior rejection', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        isApproved: true,
      };

      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.approveProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { isApproved: true, rejectedAt: null, rejectionReason: null },
      });
      expect(result).toEqual(mockProduct);
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

      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.rejectProduct(productId, 'Fotos borrosas');

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
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
      mockPrismaService.client.product.update.mockResolvedValue({
        id: productId,
      });

      await service.rejectProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: {
          isApproved: false,
          rejectedAt: expect.any(Date),
          rejectionReason: null,
        },
      });
    });
  });
});
