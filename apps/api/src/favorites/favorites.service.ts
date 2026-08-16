import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { translatePrismaError } from '../common/prisma-error';
import { resolvePagination } from '../common/pagination';

// A product a buyer favorited while approved can later be rejected by
// moderation — the Favorite row survives, so `findAll` still resolves it.
// `rejectionReason`/`rejectedAt` are moderation-internal (ProductsService's
// `findOne` only ever shows them to the product's own seller or an admin),
// so this select leaves them out entirely rather than exposing them to
// whichever buyer happened to bookmark the listing before it was rejected.
export const FAVORITE_PRODUCT_SELECT = {
  id: true,
  title: true,
  description: true,
  category: true,
  brand: true,
  size: true,
  condition: true,
  price: true,
  sellerId: true,
  isApproved: true,
  soldAt: true,
  createdAt: true,
  updatedAt: true,
  images: true,
  seller: { select: { id: true, name: true } },
} as const;

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async findAll(userId: string, query: any) {
    const { page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const [favorites, total] = await Promise.all([
      this.prisma.client.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          product: { select: FAVORITE_PRODUCT_SELECT },
        },
      }),
      this.prisma.client.favorite.count({ where: { userId } }),
    ]);

    // The web app renders a favorited product with the same catalog card
    // used on the public catalog, so it needs the same rating info — without
    // this, the identical listing would show a rating on /products and none
    // on /favoritos.
    const products = await this.productsService.withAverageRating(
      favorites.map((favorite) => favorite.product),
    );
    const data = favorites.map((favorite, index) => ({
      ...favorite,
      product: products[index],
    }));

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // A lightweight sibling to findAll(): every FavoriteButton across the app
  // (catalog cards, the product detail page) only needs to answer "is this
  // product one of mine?", not the full paginated list with product details
  // and rating enrichment findAll's own callers actually render. Sharing one
  // endpoint for both meant every heart icon paid for a product join and a
  // review aggregate it never used.
  async findAllIds(userId: string) {
    const favorites = await this.prisma.client.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });

    return { productIds: favorites.map((favorite) => favorite.productId) };
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
        product: { select: FAVORITE_PRODUCT_SELECT },
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
