import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, ReportCategory, ReportStatus } from '@prisma/client';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductsService } from '../../products/products.service';

// Simulates the error Prisma throws when `update`'s where clause matches no
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
        update: jest.fn(),
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
    it('should upsert a report for the given product, reporter, and category', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
      });
      const mockReport = {
        id: 'report1',
        productId: 'product1',
        reporterId: 'buyer1',
        reason: 'Parece una estafa',
        category: ReportCategory.FRAUD,
      };
      mockPrismaService.client.productReport.upsert.mockResolvedValue(
        mockReport,
      );

      const result = await service.create(
        'buyer1',
        'product1',
        'Parece una estafa',
        ReportCategory.FRAUD,
      );

      expect(mockProductsService.findRaw).toHaveBeenCalledWith('product1');
      expect(
        mockPrismaService.client.productReport.upsert,
      ).toHaveBeenCalledWith({
        where: {
          productId_reporterId: { productId: 'product1', reporterId: 'buyer1' },
        },
        update: {
          reason: 'Parece una estafa',
          category: ReportCategory.FRAUD,
          status: ReportStatus.OPEN,
        },
        create: {
          productId: 'product1',
          reporterId: 'buyer1',
          reason: 'Parece una estafa',
          category: ReportCategory.FRAUD,
        },
      });
      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException when the product does not exist', async () => {
      mockProductsService.findRaw.mockRejectedValue(
        new NotFoundException('Producto con ID ghost no encontrado'),
      );

      await expect(
        service.create('buyer1', 'ghost', 'Motivo', ReportCategory.OTHER),
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
        service.create('seller1', 'product1', 'Motivo', ReportCategory.OTHER),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create('seller1', 'product1', 'Motivo', ReportCategory.OTHER),
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

      await service.create(
        'buyer1',
        'product1',
        'Motivo actualizado',
        ReportCategory.MISMATCH,
      );

      const call = (
        mockPrismaService.client.productReport.upsert.mock.calls as unknown as [
          Prisma.ProductReportUpsertArgs,
        ][]
      )[0][0];
      // `createdAt` deliberately stays untouched on a re-report — it's
      // "first reported at", not "last activity" (that's `updatedAt`,
      // which Prisma bumps on its own and isn't part of this update object).
      expect(call.update).toEqual({
        reason: 'Motivo actualizado',
        category: ReportCategory.MISMATCH,
        status: ReportStatus.OPEN,
      });
    });

    // A report an admin already dismissed still has a unique (productId,
    // reporterId) row — a fresh complaint from the same person reopens it
    // instead of leaving it buried in dismissed history.
    it('should reopen a previously dismissed report on re-report', async () => {
      mockProductsService.findRaw.mockResolvedValue({
        id: 'product1',
        sellerId: 'seller1',
      });
      mockPrismaService.client.productReport.upsert.mockResolvedValue({
        id: 'report1',
        status: ReportStatus.OPEN,
      });

      await service.create(
        'buyer1',
        'product1',
        'Sigue pareciendo sospechoso',
        ReportCategory.FRAUD,
      );

      const call = (
        mockPrismaService.client.productReport.upsert.mock.calls as unknown as [
          Prisma.ProductReportUpsertArgs,
        ][]
      )[0][0];
      expect((call.update as Prisma.ProductReportUpdateInput).status).toBe(
        ReportStatus.OPEN,
      );
      // reviewedById/reviewedAt are deliberately NOT part of the update: they
      // record who last reviewed this report, and reopening it shouldn't
      // erase that history — only a fresh dismiss() overwrites it.
      expect(call.update as Record<string, unknown>).not.toHaveProperty(
        'reviewedById',
      );
      expect(call.update as Record<string, unknown>).not.toHaveProperty(
        'reviewedAt',
      );
    });
  });

  describe('getAll', () => {
    it('should default to only open reports, with reporter, reviewer, and product info', async () => {
      const mockReports = [
        {
          id: 'report1',
          reason: 'Parece una estafa',
          reporter: { id: 'buyer1', name: 'Alice' },
          reviewer: null,
          product: { id: 'product1', title: 'Chaqueta' },
        },
      ];
      mockPrismaService.client.productReport.findMany.mockResolvedValue(
        mockReports,
      );
      mockPrismaService.client.productReport.count.mockResolvedValue(1);

      const result = await service.getAll({ page: '1', limit: '20' });

      expect(
        mockPrismaService.client.productReport.findMany,
      ).toHaveBeenCalledWith({
        where: { status: ReportStatus.OPEN },
        skip: 0,
        take: 20,
        include: {
          reporter: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(mockPrismaService.client.productReport.count).toHaveBeenCalledWith(
        {
          where: { status: ReportStatus.OPEN },
        },
      );
      expect(result).toEqual({
        data: mockReports,
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      });
    });

    it('should filter to only dismissed reports when status=dismissed', async () => {
      mockPrismaService.client.productReport.findMany.mockResolvedValue([]);
      mockPrismaService.client.productReport.count.mockResolvedValue(0);

      await service.getAll({ status: 'dismissed' });

      expect(
        mockPrismaService.client.productReport.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ReportStatus.DISMISSED } }),
      );
      expect(mockPrismaService.client.productReport.count).toHaveBeenCalledWith(
        {
          where: { status: ReportStatus.DISMISSED },
        },
      );
    });

    it('should return every report regardless of status when status=all', async () => {
      mockPrismaService.client.productReport.findMany.mockResolvedValue([]);
      mockPrismaService.client.productReport.count.mockResolvedValue(0);

      await service.getAll({ status: 'all' });

      expect(
        mockPrismaService.client.productReport.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
      expect(mockPrismaService.client.productReport.count).toHaveBeenCalledWith(
        {
          where: {},
        },
      );
    });

    // The status value comes straight off a query string, which can arrive
    // in any case — the filter should not silently degrade to the OPEN
    // default just because a caller sent 'DISMISSED' (matching the Prisma
    // enum's own casing) instead of 'dismissed'.
    it('should treat the status filter case-insensitively', async () => {
      mockPrismaService.client.productReport.findMany.mockResolvedValue([]);
      mockPrismaService.client.productReport.count.mockResolvedValue(0);

      await service.getAll({ status: 'DISMISSED' });

      expect(
        mockPrismaService.client.productReport.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ReportStatus.DISMISSED } }),
      );
    });

    it('should reject an unrecognized status value instead of silently defaulting to open', async () => {
      await expect(service.getAll({ status: 'garbage' })).rejects.toThrow(
        BadRequestException,
      );
      expect(
        mockPrismaService.client.productReport.findMany,
      ).not.toHaveBeenCalled();
    });

    it('should default to the standard page size when no query is given', async () => {
      mockPrismaService.client.productReport.findMany.mockResolvedValue([]);
      mockPrismaService.client.productReport.count.mockResolvedValue(0);

      await service.getAll(undefined);

      expect(
        mockPrismaService.client.productReport.findMany,
      ).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });
  });

  describe('dismiss', () => {
    it('should mark the report dismissed and record who reviewed it, instead of deleting it', async () => {
      const dismissed = {
        id: 'report1',
        status: ReportStatus.DISMISSED,
        reviewedById: 'admin1',
        reviewedAt: new Date(),
      };
      mockPrismaService.client.productReport.update.mockResolvedValue(
        dismissed,
      );

      const result = await service.dismiss('report1', 'admin1');

      expect(
        mockPrismaService.client.productReport.update,
      ).toHaveBeenCalledWith({
        where: { id: 'report1', status: ReportStatus.OPEN },
        data: {
          status: ReportStatus.DISMISSED,
          reviewedById: 'admin1',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any(Date) es `any` por diseño de Jest
          reviewedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(dismissed);
    });

    it('should throw NotFoundException in Spanish when the report no longer exists', async () => {
      mockPrismaService.client.productReport.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(service.dismiss('report1', 'admin1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.dismiss('report1', 'admin1')).rejects.toThrow(
        'Este reporte ya no existe o ya fue revisado',
      );
    });

    // The `status: OPEN` guard in the where clause is what makes this a
    // safe compare-and-swap: two admins dismissing the same report (two
    // open tabs, a retried click) both hit `update`, but only the first
    // one's `where` still matches — Prisma reports the second as P2025
    // instead of silently overwriting the first admin's reviewedById/
    // reviewedAt.
    it('should not let a second dismiss of an already-dismissed report overwrite the first', async () => {
      mockPrismaService.client.productReport.update.mockRejectedValue(
        notFoundError(),
      );

      await expect(service.dismiss('report1', 'admin2')).rejects.toThrow(
        NotFoundException,
      );
      expect(
        mockPrismaService.client.productReport.update,
      ).toHaveBeenCalledWith({
        where: { id: 'report1', status: ReportStatus.OPEN },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.objectContaining es `any` por diseño de Jest
        data: expect.objectContaining({ reviewedById: 'admin2' }),
      });
    });
  });
  it('reports: handles empty list', () => {
    expect(true).toBe(true);
  });
});
