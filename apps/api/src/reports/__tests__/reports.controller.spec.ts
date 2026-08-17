import { Test, TestingModule } from '@nestjs/testing';
import { ReportCategory } from '@prisma/client';
import { ReportsController } from '../reports.controller';
import { ReportsService } from '../reports.service';
import { AuthRequest } from '../../types/request.types';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: ReportsService;

  const mockReportsService = {
    create: jest.fn(),
    getAll: jest.fn(),
    dismiss: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    reportsService = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it("should call reportsService.create with the requester's id and the DTO fields", async () => {
      const mockReq = {
        user: { id: 'buyer1', email: 'a@b.c', role: 'USER' },
      } as AuthRequest;
      const mockResult = { id: 'report1' };
      mockReportsService.create.mockResolvedValue(mockResult);

      const result = await controller.create(mockReq, {
        productId: 'product1',
        reason: 'Parece una estafa',
        category: ReportCategory.FRAUD,
      });

      expect(reportsService.create).toHaveBeenCalledWith(
        'buyer1',
        'product1',
        'Parece una estafa',
        ReportCategory.FRAUD,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('getAll', () => {
    it('should call reportsService.getAll with the query', async () => {
      const query = { page: '1', limit: '20' };
      const mockResult = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, pages: 0 },
      };
      mockReportsService.getAll.mockResolvedValue(mockResult);

      const result = await controller.getAll(query);

      expect(reportsService.getAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('dismiss', () => {
    it("should call reportsService.dismiss with the report id and the admin's id", async () => {
      const mockReq = {
        user: { id: 'admin1', email: 'a@b.c', role: 'ADMIN' },
      } as AuthRequest;
      const mockResult = { id: 'report1', status: 'DISMISSED' };
      mockReportsService.dismiss.mockResolvedValue(mockResult);

      const result = await controller.dismiss(mockReq, 'report1');

      expect(reportsService.dismiss).toHaveBeenCalledWith(
        'report1',
        'admin1',
      );
      expect(result).toEqual(mockResult);
    });
  });
});
