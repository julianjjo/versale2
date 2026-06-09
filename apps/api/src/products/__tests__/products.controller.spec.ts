import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AuthRequest } from '../../../src/types/request.types';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    findAllForAdmin: jest.Mock;
    approveProduct: jest.Mock;
  } = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findAllForAdmin: jest.fn(),
    approveProduct: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
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

      expect(mockProductsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('findOne', () => {
    it('should call productsService.findOne with id', async () => {
      const productId = 'product1';
      const mockProduct = {
        id: productId,
        title: 'Test Product',
        description: 'A test product',
        price: 10.0,
      };

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(productId);

      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId);
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

      expect(mockProductsService.create).toHaveBeenCalledWith(
        createProductDto,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('update', () => {
    it('should call productsService.update with id, updateProductDto and userId from request', async () => {
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

      expect(mockProductsService.update).toHaveBeenCalledWith(
        productId,
        updateProductDto,
        userId,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it('should call productsService.remove with id and userId from request', async () => {
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

      expect(mockProductsService.remove).toHaveBeenCalledWith(
        productId,
        userId,
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

      expect(mockProductsService.findAllForAdmin).toHaveBeenCalledWith(query);
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

      expect(mockProductsService.approveProduct).toHaveBeenCalledWith(
        productId,
      );
      expect(result).toEqual(mockResult);
    });
  });
});
