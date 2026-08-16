import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async create(userId: string, productId: string, reason: string) {
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
    // updates the existing row (refreshing the reason) instead of erroring
    // or silently duplicating. `createdAt` stays untouched (it's genuinely
    // "first reported at"); Prisma bumps `updatedAt` on its own, which is
    // what the admin queue actually sorts by.
    return this.prisma.client.productReport.upsert({
      where: { productId_reporterId: { productId, reporterId: userId } },
      update: { reason },
      create: { productId, reporterId: userId, reason },
    });
  }

  async getAll(query: any) {
    const { page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const [reports, total] = await Promise.all([
      this.prisma.client.productReport.findMany({
        skip,
        take: limitNum,
        include: {
          reporter: { select: { id: true, name: true } },
          product: { select: { id: true, title: true } },
        },
        // Most recently active first — a re-reported (refined) complaint is
        // the one most worth an admin's attention right now.
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.client.productReport.count(),
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

  async dismiss(id: string) {
    try {
      await this.prisma.client.productReport.delete({ where: { id } });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new NotFoundException('Este reporte ya no existe');
        },
      });
    }

    return { success: true };
  }
}
