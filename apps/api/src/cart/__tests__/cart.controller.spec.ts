import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from '../cart.controller';
import { CartService } from '../cart.service';
import { AuthRequest } from '../../../src/types/request.types';

describe('CartController', () => {
  let controller: CartController;
  let cartService: CartService;

  const mockCartService = {
    getCart: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    removeItem: jest.fn(),
    clearCart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
    cartService = module.get<CartService>(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCart', () => {
    it('should call cartService.getCart with userId from request', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockCart = {
        id: 'cart1',
        userId,
        items: [],
      };

      mockCartService.getCart.mockResolvedValue(mockCart);

      const result = await controller.getCart(mockReq);

      expect(cartService.getCart).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockCart);
    });
  });

  describe('addItem', () => {
    it('should call cartService.addItem with userId, productId and quantity', async () => {
      const userId = 'user1';
      const productId = 'product1';
      const quantity = 2;
      const body = { productId, quantity };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: 'item1',
        cartId: 'cart1',
        productId,
        quantity,
        priceAtAdd: 10.0,
      };

      mockCartService.addItem.mockResolvedValue(mockResult);

      const result = await controller.addItem(mockReq, body);

      expect(cartService.addItem).toHaveBeenCalledWith(userId, productId, quantity);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateItem', () => {
    it('should call cartService.updateItem with itemId, quantity and userId', async () => {
      const userId = 'user1';
      const itemId = 'item1';
      const quantity = 5;
      const body = { quantity };
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: itemId,
        quantity,
      };

      mockCartService.updateItem.mockResolvedValue(mockResult);

      const result = await controller.updateItem(mockReq, itemId, body);

      expect(cartService.updateItem).toHaveBeenCalledWith(itemId, quantity, userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('removeItem', () => {
    it('should call cartService.removeItem with itemId and userId', async () => {
      const userId = 'user1';
      const itemId = 'item1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = {
        id: itemId,
      };

      mockCartService.removeItem.mockResolvedValue(mockResult);

      const result = await controller.removeItem(mockReq, itemId);

      expect(cartService.removeItem).toHaveBeenCalledWith(itemId, userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('clearCart', () => {
    it('should call cartService.clearCart with userId', async () => {
      const userId = 'user1';
      const mockReq = {
        user: { id: userId, email: 'test@example.com', role: 'USER' },
      } as AuthRequest;

      const mockResult = { success: true };

      mockCartService.clearCart.mockResolvedValue(mockResult);

      const result = await controller.clearCart(mockReq);

      expect(cartService.clearCart).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });
  });
});