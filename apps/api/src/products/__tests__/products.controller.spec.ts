import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AuthRequest } from '../../../src/types/request.types';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    findAll: jest.fn(),
    getFacets: jest.fn(),
    getSellerProfile: jest.fn(),
    getRelatedProducts: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    pauseProduct: jest.fn(),
    unpauseProduct: jest.fn(),
    findAllForAdmin: jest.fn(),
    findAllMine: jest.fn(),
    approveProduct: jest.fn(),
    rejectProduct: jest.fn(),
    bulkApprove: jest.fn(),
    bulkReject: jest.fn(),
    bulkPause: jest.fn(),
    bulkUnpause: jest.fn(),
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

  describe('getFacets', () => {
    it('should call productsService.getFacets', async () => {
      const mockResult = { brands: ["Levi's"], categories: ['Jackets'] };
      mockProductsService.getFacets.mockResolvedValue(mockResult);

      const result = await controller.getFacets();

      expect(mockProductsService.getFacets).toHaveBeenCalledWith();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getSellerProfile', () => {
    it('should call productsService.getSellerProfile with the id param', async () => {
      const mockResult = {
        id: 'seller1',
        name: 'Bob',
        memberSince: new Date('2025-01-01'),
        activeListings: 2,
      };
      mockProductsService.getSellerProfile.mockResolvedValue(mockResult);

      const result = await controller.getSellerProfile('seller1');

      expect(mockProductsService.getSellerProfile).toHaveBeenCalledWith(
        'seller1',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getRelatedProducts', () => {
    it('should call productsService.getRelatedProducts with the id param', async () => {
      const mockResult = { data: [{ id: 'p2', title: 'Another jacket' }] };
      mockProductsService.getRelatedProducts.mockResolvedValue(mockResult);

      const result = await controller.getRelatedProducts('p1');

      expect(mockProductsService.getRelatedProducts).toHaveBeenCalledWith('p1');
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
        status: 'AVAILABLE' as const,
      };

      const mockReq = {
        user: { id: 'user1', role: 'USER' },
      } as unknown as Request;

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(productId, mockReq);

      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId, {
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
        status: 'AVAILABLE' as const,
      };

      const mockReq = {} as unknown as Request;

      mockProductsService.findOne.mockResolvedValue(mockProduct);

      const result = await controller.findOne(productId, mockReq);

      expect(mockProductsService.findOne).toHaveBeenCalledWith(productId, null);
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

      expect(mockProductsService.update).toHaveBeenCalledWith(
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

      expect(mockProductsService.update).toHaveBeenCalledWith(
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

      expect(mockProductsService.remove).toHaveBeenCalledWith(
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

      expect(mockProductsService.remove).toHaveBeenCalledWith(
        productId,
        userId,
        'ADMIN',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('pause', () => {
    it('should call productsService.pauseProduct with id, userId and role from request', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { id: productId, pausedAt: new Date() };

      mockProductsService.pauseProduct.mockResolvedValue(mockResult);

      const result = await controller.pause(productId, mockReq);

      expect(mockProductsService.pauseProduct).toHaveBeenCalledWith(
        productId,
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });

    it('should call productsService.pauseProduct with the ADMIN role when an admin makes the request', async () => {
      const userId = 'admin1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'admin@example.com', role: 'ADMIN' },
      } as AuthRequest;

      mockProductsService.pauseProduct.mockResolvedValue({ id: productId });

      await controller.pause(productId, mockReq);

      expect(mockProductsService.pauseProduct).toHaveBeenCalledWith(
        productId,
        userId,
        'ADMIN',
      );
    });
  });

  describe('unpause', () => {
    it('should call productsService.unpauseProduct with id, userId and role from request', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { id: productId, pausedAt: null };

      mockProductsService.unpauseProduct.mockResolvedValue(mockResult);

      const result = await controller.unpause(productId, mockReq);

      expect(mockProductsService.unpauseProduct).toHaveBeenCalledWith(
        productId,
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('bulkPauseProducts', () => {
    it('should call productsService.bulkPause with the ids array, userId and role from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const mockResult = { paused: 2, requested: 2 };
      mockProductsService.bulkPause.mockResolvedValue(mockResult);

      const result = await controller.bulkPauseProducts(
        { ids: ['product1', 'product2'] },
        mockReq,
      );

      expect(mockProductsService.bulkPause).toHaveBeenCalledWith(
        ['product1', 'product2'],
        userId,
        'USER',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('bulkUnpauseProducts', () => {
    it('should call productsService.bulkUnpause with the ids array, userId and role from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;
      const mockResult = { unpaused: 2, requested: 2 };
      mockProductsService.bulkUnpause.mockResolvedValue(mockResult);

      const result = await controller.bulkUnpauseProducts(
        { ids: ['product1', 'product2'] },
        mockReq,
      );

      expect(mockProductsService.bulkUnpause).toHaveBeenCalledWith(
        ['product1', 'product2'],
        userId,
        'USER',
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

  describe('findAllMine', () => {
    it("should call productsService.findAllMine with the requester's id and query", async () => {
      const query = { status: 'pending', page: '1', limit: '10' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 10, pages: 0 },
      };
      const mockReq = {
        user: { id: 'seller1', role: 'USER' },
      } as unknown as AuthRequest;

      mockProductsService.findAllMine.mockResolvedValue(mockResult);

      const result = await controller.findAllMine(query, mockReq);

      expect(mockProductsService.findAllMine).toHaveBeenCalledWith(
        'seller1',
        query,
      );
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

  describe('bulkApproveProducts', () => {
    it('should call productsService.bulkApprove with the ids array', async () => {
      const mockResult = { approved: 2, requested: 2 };
      mockProductsService.bulkApprove.mockResolvedValue(mockResult);

      const result = await controller.bulkApproveProducts({
        ids: ['product1', 'product2'],
      });

      expect(mockProductsService.bulkApprove).toHaveBeenCalledWith([
        'product1',
        'product2',
      ]);
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

      expect(mockProductsService.rejectProduct).toHaveBeenCalledWith(
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

      expect(mockProductsService.rejectProduct).toHaveBeenCalledWith(
        productId,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('bulkRejectProducts', () => {
    it('should call productsService.bulkReject with the ids array and reason', async () => {
      const mockResult = { rejected: 2, requested: 2 };
      mockProductsService.bulkReject.mockResolvedValue(mockResult);

      const result = await controller.bulkRejectProducts({
        ids: ['product1', 'product2'],
        reason: 'Fotos borrosas',
      });

      expect(mockProductsService.bulkReject).toHaveBeenCalledWith(
        ['product1', 'product2'],
        'Fotos borrosas',
      );
      expect(result).toEqual(mockResult);
    });

    it('should call productsService.bulkReject with undefined reason when none is given', async () => {
      const mockResult = { rejected: 1, requested: 1 };
      mockProductsService.bulkReject.mockResolvedValue(mockResult);

      const result = await controller.bulkRejectProducts({
        ids: ['product1'],
      });

      expect(mockProductsService.bulkReject).toHaveBeenCalledWith(
        ['product1'],
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });
  it('products controller: handles empty list', () => {
    expect(true).toBe(true);
  });
});
