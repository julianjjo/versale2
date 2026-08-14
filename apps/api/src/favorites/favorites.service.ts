import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { translatePrismaError } from '../common/prisma-error';

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
    const product = await this.productsService.findRaw(productId);

    // Mirrors the public catalog's visibility rule (see
    // ProductsService#findOne's `canView` check): an unapproved listing isn't
    // shown to buyers, so it can't be bookmarked either — otherwise a guessed
    // or leaked productId would let someone favorite (and keep seeing full
    // details of) a listing moderation never approved.
    if (!product.isApproved) {
      throw new BadRequestException(
        'Este producto no está disponible para agregar a favoritos',
      );
    }

    if (product.sellerId === userId) {
      throw new BadRequestException(
        'No puedes agregar tu propio producto a favoritos',
      );
    }

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
    try {
      await this.prisma.client.favorite.delete({
        where: { userId_productId: { userId, productId } },
      });
    } catch (error) {
      translatePrismaError(error, {
        // Two concurrent unfavorite calls (two tabs, a retried request) can
        // both pass a check-then-act race: the first delete succeeds, the
        // second targets an already-gone row and Prisma raises P2025. Without
        // this handler that surfaced as an unhandled 500 instead of the same
        // Spanish 404 every other "not found" path returns.
        P2025: () => {
          throw new NotFoundException('Este producto no está en tus favoritos');
        },
      });
    }

    return { success: true };
  }
}
