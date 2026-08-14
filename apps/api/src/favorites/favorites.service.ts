import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.client.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: { seller: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async addFavorite(userId: string, productId: string) {
    // Confirms the product exists (and surfaces the same 404 as everywhere
    // else) before creating a bookmark that would otherwise dangle.
    await this.productsService.findRaw(productId);

    // Favoriting twice is a no-op, not an error: the button just toggles.
    return this.prisma.client.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      update: {},
      create: { userId, productId },
      include: {
        product: {
          include: { seller: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async removeFavorite(userId: string, productId: string) {
    const favorite = await this.prisma.client.favorite.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (!favorite) {
      throw new NotFoundException('Este producto no está en tus favoritos');
    }

    await this.prisma.client.favorite.delete({ where: { id: favorite.id } });
    return { success: true };
  }
}
