import { Test, TestingModule } from '@nestjs/testing';
import { QuestionsController } from '../questions.controller';
import { QuestionsService } from '../questions.service';
import { AuthRequest } from '../../types/request.types';

describe('QuestionsController', () => {
  let controller: QuestionsController;

  const mockQuestionsService = {
    create: jest.fn(),
    answer: jest.fn(),
    remove: jest.fn(),
    getAllForAdmin: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [
        { provide: QuestionsService, useValue: mockQuestionsService },
      ],
    }).compile();

    controller = module.get<QuestionsController>(QuestionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it("should call questionsService.create with the requester's id and the DTO fields", async () => {
      const mockReq = {
        user: { id: 'buyer1', email: 'a@b.c', role: 'USER' },
      } as AuthRequest;
      const mockResult = { id: 'question1' };
      mockQuestionsService.create.mockResolvedValue(mockResult);

      const result = await controller.create(mockReq, {
        productId: 'product1',
        question: '¿La talla es de hombre o de mujer?',
      });

      expect(mockQuestionsService.create).toHaveBeenCalledWith(
        'buyer1',
        'product1',
        '¿La talla es de hombre o de mujer?',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('answer', () => {
    it("should call questionsService.answer with the id, the requester's id, and the answer", async () => {
      const mockReq = {
        user: { id: 'seller1', email: 'a@b.c', role: 'USER' },
      } as AuthRequest;
      const mockResult = { id: 'question1', answer: 'Es de mujer' };
      mockQuestionsService.answer.mockResolvedValue(mockResult);

      const result = await controller.answer(mockReq, 'question1', {
        answer: 'Es de mujer',
      });

      expect(mockQuestionsService.answer).toHaveBeenCalledWith(
        'question1',
        'seller1',
        'Es de mujer',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('remove', () => {
    it("should call questionsService.remove with the id, the requester's id, and role", async () => {
      const mockReq = {
        user: { id: 'buyer1', email: 'a@b.c', role: 'USER' },
      } as AuthRequest;
      const mockResult = { success: true };
      mockQuestionsService.remove.mockResolvedValue(mockResult);

      const result = await controller.remove(mockReq, 'question1');

      expect(mockQuestionsService.remove).toHaveBeenCalledWith(
        'question1',
        'buyer1',
        'USER',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAllForAdmin', () => {
    it('should call questionsService.getAllForAdmin with the query', async () => {
      const query = { page: '1', limit: '20' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, pages: 0 },
      };
      mockQuestionsService.getAllForAdmin.mockResolvedValue(mockResult);

      const result = await controller.getAllForAdmin(query);

      expect(mockQuestionsService.getAllForAdmin).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });
});
