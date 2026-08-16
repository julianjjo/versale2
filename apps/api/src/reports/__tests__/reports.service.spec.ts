import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';

// Simulates the error Prisma throws when `delete`'s where clause matches no
// row — the shape a second dismiss of the same report (two admin tabs, a
// retried request) would trigger.
function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError('No record found', {
    code: 'P2025',
    clientVersion: 'test',
  });
}

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrismaService = {
    client: {
      productReport: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    },
  };

  const mockProductsService = {
    findRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProductsService, useValue: mockProductsService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should upsert a report for the given product and reporter', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
      });
      const mockReport = {
        id: 'report1',
        productId: 'product1',
        reporterId: 'buyer1',
        reason: 'Parece una estafa',
      };
      mockPrismaService.client.productReport.upsert.mockResolvedValue(
        mockReport,
      );

      const result = await service.create(
        'buyer1',
        'product1',
        'Parece una estafa',
      );

      expect(mockProductsService.findRaw).toHaveBeenCalledWith('product1');
      expect(mockPrismaService.client.productReport.upsert).toHaveBeenCalledWith({
        where: {
          productId_reporterId: { productId: 'product1', reporterId: 'buyer1' },
        },
        update: { reason: 'Parece una estafa' },
        create: {
          productId: 'product1',
          reporterId: 'buyer1',
          reason: 'Parece una estafa',
        },
      });
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductsService.findRaw.mockRejectedValue(
        new NotFoundException('Producto con ID ghost no encontrado'),
      );

      await expect(
        service.create('buyer1', 'ghost', 'Motivo'),
      ).rejects.toThrow(NotFoundException);
      expect(
        mockPrismaService.client.productReport.upsert,
      ).not.toHaveBeenCalled();
    });

    it('should refuse to let a seller report their own product', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
      });

      await expect(
        service.create('seller1', 'product1', 'Motivo'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('seller1', 'product1', 'Motivo'),
      ).rejects.toThrow('No puedes reportar tu propio producto');
      expect(
        mockPrismaService.client.productReport.upsert,
      ).not.toHaveBeenCalled();
    });

    // Reporting the same product twice isn't a second signal — it's the
    // same complaint, possibly refined — so it must not throw a unique-
    // constraint error or silently duplicate a row.
    it('should not require the reporter to only report a product once (upsert, not create)', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
      });
      mockPrismaService.client.productReport.upsert.mockResolvedValue({
        id: 'report1',
      });

      await service.create('buyer1', 'product1', 'Motivo actualizado');

      const call = mockPrismaService.client.productReport.upsert.mock.calls[0][0];
      // `createdAt` deliberately stays untouched on a re-report — it's
      // "first reported at", not "last activity" (that's `updatedAt`,
      // which Prisma bumps on its own and isn't part of this update object).
      expect(call.update).toEqual({ reason: 'Motivo actualizado' });
    });
  });

  describe('getAll', () => {
    it('should return paginated reports with reporter and product info', async () => {
      const mockReports = [
        {
          id: 'report1',
          reason: 'Parece una estafa',
          reporter: { id: 'buyer1', name: 'Alice' },
          product: { id: 'product1', title: 'Chaqueta' },
        },
      ];
      mockPrismaService.client.productReport.findMany.mockResolvedValue(
        mockReports,
      );
      mockPrismaService.client.productReport.count.mockResolvedValue(1);

      const result = await service.getAll({ page: '1', limit: '20' });

      expect(mockPrismaService.client.productReport.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        include: {
          reporter: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual({
        data: mockReports,
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      });
    });

    it('should default to the standard page size when no query is given', async () => {
      mockPrismaService.client.productReport.findMany.mockResolvedValue([]);
      mockPrismaService.client.productReport.count.mockResolvedValue(0);

      await service.getAll(undefined);

      expect(mockPrismaService.client.productReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });
  });

  describe('dismiss', () => {
    it('should delete the report by id', async () => {
      mockPrismaService.client.productReport.delete.mockResolvedValue({
        id: 'report1',
      });

      const result = await service.dismiss('report1');

      expect(mockPrismaService.client.productReport.delete).toHaveBeenCalledWith({
        where: { id: 'report1' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw NotFoundException in Spanish when the report no longer exists', async () => {
      mockPrismaService.client.productReport.delete.mockRejectedValue(
        notFoundError(),
      );

      await expect(service.dismiss('report1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.dismiss('report1')).rejects.toThrow(
        'Este reporte ya no existe',
      );
    });
  });
});
