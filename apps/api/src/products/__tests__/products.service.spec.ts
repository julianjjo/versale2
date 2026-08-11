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
    it('should update a product if user is the seller', async () => {
      const productId = 'product1';
      const userId = 'seller1';
      const updateProductDto: UpdateProductDto = {
        title: 'Updated Product',
        price: 15.0,
      };

      const existingProduct = {
        id: productId,
        title: 'Old Title',
        description: 'Old description',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
        sellerId: userId, // same as userId
        isApproved: true,
      };

      const updatedProduct = {
        ...existingProduct,
        ...updateProductDto,
        id: productId,
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
        data: updateProductDto,
        include: {
          seller: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual(updatedProduct);
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

    it('should allow an admin to update a product they do not own', async () => {
      const productId = 'product1';
      const sellerId = 'seller1';
      const adminId = 'admin1';
      const updateProductDto: UpdateProductDto = { title: 'New Title' };

      const existingProduct = {
        id: productId,
        sellerId, // different from adminId
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

  describe('findAllForAdmin', () => {
    it('should return paginated products for admin (including not approved)', async () => {
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

    it('should filter by isApproved when provided, so admins can count pending products', async () => {
      const query = { isApproved: 'false', limit: '1' };

      mockPrismaService.client.product.findMany.mockResolvedValue([]);
      mockPrismaService.client.product.count.mockResolvedValue(3);

      const result = await service.findAllForAdmin(query);

      expect(mockPrismaService.client.product.findMany).toHaveBeenCalledWith({
        where: { isApproved: false },
        skip: 0,
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      });
      expect(mockPrismaService.client.product.count).toHaveBeenCalledWith({
        where: { isApproved: false },
      });
      expect(result.meta.total).toBe(3);
    });
  });

  describe('approveProduct', () => {
    it('should approve a product', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        isApproved: true,
      };

      mockPrismaService.client.product.update.mockResolvedValue(mockProduct);

      const result = await service.approveProduct(productId);

      expect(mockPrismaService.client.product.update).toHaveBeenCalledWith({
        where: { id: productId },
        data: { isApproved: true },
      });
      expect(result).toEqual(mockProduct);
    });
  });
});
