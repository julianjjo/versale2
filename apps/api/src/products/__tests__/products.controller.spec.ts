import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AuthRequest } from '../../../src/types/request.types';

describe('ProductsController', () => {
  let controller: ProductsController;
  let productsService: ProductsService;

  const mockProductsService = {
    findAll: jest.fn(),
    getFacets: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAllForAdmin: jest.fn(),
    approveProduct: jest.fn(),
    rejectProduct: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
    productsService = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should call productsService.findAll with query', async () => {
      const query = { search: 'test', page: '1', limit: '10' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      };

      mockProductsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(productsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getFacets', () => {
    it('should call productsService.getFacets', async () => {
      const mockResult = { brands: ["Levi's"], categories: ['Jackets'] };
      mockProductsService.getFacets.mockResolvedValue(mockResult);

      const result = await controller.getFacets();

      expect(productsService.getFacets).toHaveBeenCalledWith();
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call productsService.findOne with id and requester from request user', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        price: 10.0,
      };

      const mockReq = {
        user: { id: 'user1', role: 'USER' },
      } as unknown as Request;

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(productId, mockReq);

      expect(productsService.findOne).toHaveBeenCalledWith(productId, {
        id: 'user1',
        role: 'USER',
      });
      expect(result).toEqual(mockProduct);
    });

    it('should call productsService.findOne with null requester when no user on request', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        price: 10.0,
      };

      const mockReq = {} as unknown as Request;

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(productId, mockReq);

      expect(productsService.findOne).toHaveBeenCalledWith(productId, null);
      expect(result).toEqual(mockProduct);
    });
  });

  describe('create', () => {
    it('should call productsService.create with createProductDto and userId from request', async () => {
      const userId = 'user1';
      const createProductDto: CreateProductDto = {
        title: 'Test Product',
        description: 'A test product',
        category: 'Test',
        size: 'M',
        condition: 'New',
        price: 10.0,
      };

      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: 'product1',
        ...createProductDto,
        sellerId: userId,
      };

      mockProductsService.create.mockResolvedValue(mockResult);

      const result = await controller.create(createProductDto, mockReq);

      expect(productsService.create).toHaveBeenCalledWith(
        createProductDto,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('should call productsService.update with id, updateProductDto, userId and role from request', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const updateProductDto: UpdateProductDto = {
        title: 'Updated Product',
        price: 15.0,
      };

      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: productId,
        ...updateProductDto,
      };

      mockProductsService.update.mockResolvedValue(mockResult);

      const result = await controller.update(
        productId,
        updateProductDto,
        mockReq,
      );

      expect(productsService.update).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });

    it('should call productsService.update with the ADMIN role when an admin makes the request', async () => {
      const userId = 'admin1';
      const productId = 'product1';
      const updateProductDto: UpdateProductDto = {
        title: 'Updated Product',
      };

      const mockReq = {
        user: { id: userId, email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;

      const mockResult = {
        id: productId,
        ...updateProductDto,
      };

      mockProductsService.update.mockResolvedValue(mockResult);

      const result = await controller.update(
        productId,
        updateProductDto,
        mockReq,
      );

      expect(productsService.update).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        userId,
        'ADMIN',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('should call productsService.remove with id, userId and role from request', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: productId,
      };

      mockProductsService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(productId, mockReq);

      expect(productsService.remove).toHaveBeenCalledWith(
        productId,
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });

    it('should call productsService.remove with the ADMIN role when an admin makes the request', async () => {
      const userId = 'admin1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;

      const mockResult = {
        id: productId,
      };

      mockProductsService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(productId, mockReq);

      expect(productsService.remove).toHaveBeenCalledWith(
        productId,
        userId,
        'ADMIN',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('findAllForAdmin', () => {
    it('should call productsService.findAllForAdmin with query', async () => {
      const query = { page: '1', limit: '10' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      };

      mockProductsService.findAllForAdmin.mockResolvedValue(mockResult);

      const result = await controller.findAllForAdmin(query);

      expect(productsService.findAllForAdmin).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('approveProduct', () => {
    it('should call productsService.approveProduct with id', async () => {
      const productId = 'product1';
      const mockResult = {
        id: productId,
        isApproved: true,
      };

      mockProductsService.approveProduct.mockResolvedValue(mockResult);

      const result = await controller.approveProduct(productId);

      expect(productsService.approveProduct).toHaveBeenCalledWith(productId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('rejectProduct', () => {
    it('should call productsService.rejectProduct with id and reason', async () => {
      const productId = 'product1';
      const mockResult = {
        id: productId,
        isApproved: false,
        rejectionReason: 'Descripción incompleta',
      };

      mockProductsService.rejectProduct.mockResolvedValue(mockResult);

      const result = await controller.rejectProduct(productId, {
        reason: 'Descripción incompleta',
      });

      expect(productsService.rejectProduct).toHaveBeenCalledWith(
        productId,
        'Descripción incompleta',
      );
      expect(result).toEqual(mockResult);
    });

    it('should call productsService.rejectProduct with undefined reason when none is given', async () => {
      const productId = 'product1';
      const mockResult = { id: productId, isApproved: false };

      mockProductsService.rejectProduct.mockResolvedValue(mockResult);

      const result = await controller.rejectProduct(productId, {});

      expect(productsService.rejectProduct).toHaveBeenCalledWith(
        productId,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
