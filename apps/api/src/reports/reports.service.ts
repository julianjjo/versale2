import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReportCategory, ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async create(
    userId: string,
    productId: string,
    reason: string,
    category: ReportCategory,
  ) {
    // Confirms the product exists (and surfaces the same 404 as everywhere
    // else) before creating a report that would otherwise dangle. Unlike
    // favoriting, this deliberately does NOT require isApproved: a listing
    // that looks suspicious is exactly the kind of thing a buyer should be
    // able to flag, approved or not.
    const product = await this.productsService.findRaw(productId);

    if (product.sellerId === userId) {
      throw new BadRequestException('No puedes reportar tu propio producto');
    }

    // A second report from the same person isn't a second signal against the
    // listing — it's the same complaint, possibly with more detail — so it
    // updates the existing row (refreshing the reason/category) instead of
    // erroring or silently duplicating. `createdAt` stays untouched (it's
    // genuinely "first reported at"); Prisma bumps `updatedAt` on its own,
    // which is what the admin queue actually sorts by. Re-reporting also
    // reopens a report an admin had already dismissed — a fresh complaint
    // against the same listing is worth surfacing again, not silently
    // absorbed into a closed one.
    return this.prisma.client.productReport.upsert({
      where: { productId_reporterId: { productId, reporterId: userId } },
      update: {
        reason,
        category,
        status: ReportStatus.OPEN,
        reviewedById: null,
        reviewedAt: null,
      },
      create: { productId, reporterId: userId, reason, category },
    });
  }

  async getAll(query: any) {
    const { page, limit, status } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    // Defaults to only the reports nobody has acted on yet — dismiss() no
    // longer deletes a report, so without this the queue would keep growing
    // with resolved history instead of surfacing what still needs attention.
    const where: any = {};
    if (status === 'dismissed') {
      where.status = ReportStatus.DISMISSED;
    } else if (status !== 'all') {
      where.status = ReportStatus.OPEN;
    }

    const [reports, total] = await Promise.all([
      this.prisma.client.productReport.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          reporter: { select: { id: true, name: true } },
          reviewer: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        // Most recently active first — a re-reported (refined) complaint is
        // the one most worth an admin's attention right now.
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.productReport.count({ where }),
    ]);

    return {
      data: reports,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async dismiss(id: string, adminId: string) {
    try {
      return await this.prisma.client.productReport.update({
        where: { id },
        data: {
          status: ReportStatus.DISMISSED,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('Este reporte ya no existe');
        },
      });
    }
  }
}
