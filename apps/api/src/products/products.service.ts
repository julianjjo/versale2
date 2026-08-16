import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Role } from '../users/role.enum';
import { ProductSortBy } from './product-sort.enum';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';
import { VERIFIED_PURCHASE_STATUSES } from '../orders/order-status.enum';

// Fields moderation actually judges: if a seller changes any of them the
// listing has to be reviewed again before going back to the public catalog.
const MODERATED_FIELDS = [
  'title',
  'description',
  'price',
  'category',
  'brand',
  'condition',
  'size',
  'images',
] as const;

// Shared by approveProduct (single item) and bulkApprove (batch): what
// "approving a product" resets, in one place so the two can't drift apart.
const APPROVE_DATA = {
  isApproved: true,
  rejectedAt: null,
  rejectionReason: null,
};

// The public-catalog visibility rule — findAll, getSellerProfile's active
// count, getFacets, and getRelatedProducts all need "is this listing
// something a buyer could actually find by browsing", and each independent
// hand-copy of {isApproved:true, soldAt:null} is a chance for the rule to
// drift if it ever changes.
const APPROVED_UNSOLD = {
  isApproved: true,
  soldAt: null,
} as const;

// No route-level configurability today (see getRelatedProducts) — a plain
// module constant, matching this codebase's convention for other hardcoded
// caps (MAX_FAVORITE_IDS, MAX_ITEM_QUANTITY) rather than a default parameter
// nothing actually overrides.
const RELATED_PRODUCTS_LIMIT = 4;

// `id` as a secondary key gives ties on the primary sort column a stable
// order across separate paginated (skip/take) queries. Without it, rows
// sharing a value on a low-cardinality column like `price` — or even on
// `createdAt`, for listings bulk-approved in the same request — can be
// duplicated or skipped as a buyer pages through results, since neither
// SQLite nor any other engine guarantees tie order stays put between
// independent queries.
const SORT_ORDER_BY: Record<ProductSortBy, Prisma.ProductOrderByWithRelationInput[]> = {
  [ProductSortBy.PRICE_ASC]: [{ price: 'asc' }, { id: 'asc' }],
  [ProductSortBy.PRICE_DESC]: [{ price: 'desc' }, { id: 'asc' }],
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // Only `price` is sortable beyond the default recency order: rating is
  // computed after the page is fetched (see withAverageRating's own
  // comment on why — one groupBy for the whole page, not a column Prisma
  // could ORDER BY), so it can't be a catalog sort option without a much
  // larger restructure. An unrecognized or missing value falls back to the
  // browsing default rather than erroring, since this reads directly off
  // the query string and a stale/bookmarked URL should never 400.
  private resolveSortOrder(sortBy: unknown): Prisma.ProductOrderByWithRelationInput[] {
    // A duplicated query key (?sortBy=a&sortBy=b) arrives as an array; take
    // the first value rather than silently discarding the request, the way
    // `brand`/`category` normalize their own possibly-array input below.
    const value = Array.isArray(sortBy) ? sortBy[0] : sortBy;
    if (value && Object.values(ProductSortBy).includes(value as ProductSortBy)) {
      return SORT_ORDER_BY[value as ProductSortBy];
    }
    return [{ createdAt: 'desc' }, { id: 'asc' }];
  }

  // Shared by findAll (public catalog) and findAllMine (a seller's own
  // listings): the same four text columns, so the two search experiences
  // can't silently drift apart the way two hand-copied blocks would.
  private searchTextWhere(term: string) {
    return [
      { title: { contains: term } },
      { description: { contains: term } },
      { brand: { contains: term } },
      { category: { contains: term } },
    ];
  }

  private hasModeratedChanges(
    product: Record<string, unknown>,
    updateProductDto: UpdateProductDto,
  ) {
    const update = updateProductDto as Record<string, unknown>;

    return MODERATED_FIELDS.some((field) => {
      const next = update[field];
      if (next === undefined) {
        return false;
      }
      if (field === 'images') {
        return (
          JSON.stringify(next ?? null) !==
          JSON.stringify(product[field] ?? null)
        );
      }
      return next !== product[field];
    });
  }

  async create(createProductDto: CreateProductDto, sellerId: string) {
    const { images, ...rest } = createProductDto;
    return this.prisma.client.product.create({
      data: {
        ...rest,
        sellerId,
        ...(images !== undefined ? { images: images } : {}),
      },
    });
  }

  async findAll(query: any) {
    const {
      search,
      minPrice,
      maxPrice,
      size,
      brand,
      category,
      condition,
      sellerId,
      sortBy,
      page = 1,
      limit = 10,
    } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);
    const orderBy = this.resolveSortOrder(sortBy);

    // Sold items are one-of-a-kind: once bought they leave the public catalog.
    const where: any = { ...APPROVED_UNSOLD };

    if (search) {
      where.OR = this.searchTextWhere(String(search));
    }

    // Powers a seller's public profile page (their other listings), reusing
    // the same catalog visibility rules above rather than a bespoke query —
    // a seller's profile shows exactly what any buyer could already find by
    // browsing, never a private preview of unapproved or sold stock.
    if (sellerId) {
      where.sellerId = String(sellerId);
    }

    if (minPrice !== undefined) {
      where.price = { ...where.price, gte: Number(minPrice) };
    }
    if (maxPrice !== undefined) {
      where.price = { ...where.price, lte: Number(maxPrice) };
    }
    if (size) {
      where.size = size;
    }
    if (brand) {
      where.brand = { contains: String(brand) };
    }
    if (category) {
      where.category = String(category);
    }
    if (condition) {
      where.condition = condition;
    }

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        include: {
          seller: { select: { id: true, name: true } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return {
      data: await this.withAverageRating(products),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // Shared by findAll (public catalog) and FavoritesService.findAll (a
  // buyer's bookmarked products): the same ProductCard renders both, so both
  // need the same rating info. A buyer decides whether to open a listing
  // partly on its rating, so a list of products needs it too, not just the
  // single-product page (which already computes it from the full `reviews`
  // array `findOne` returns). One `groupBy` scoped to just this page's
  // product ids gets every average AND count in a single query, instead of
  // one aggregate per product (N+1), a separate `_count` include alongside it
  // (two scans of the same Review rows), or pulling every review row into
  // `include` just to average it in JS.
  async withAverageRating<T extends { id: string }>(
    products: T[],
  ): Promise<
    (T & { _count: { reviews: number }; averageRating: number | null })[]
  > {
    if (products.length === 0) {
      return [];
    }

    const ratings = await this.prisma.client.review.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) } },
      _avg: { rating: true },
      _count: true,
    });
    const ratingByProductId = new Map(ratings.map((r) => [r.productId, r]));

    return products.map((product) => {
      const rating = ratingByProductId.get(product.id);
      return {
        ...product,
        _count: { reviews: rating?._count ?? 0 },
        averageRating: rating?._avg.rating ?? null,
      };
    });
  }

  // Public seller profile: name, member-since date, and how many listings
  // are currently live, so a buyer who likes one item can see the rest of
  // that seller's catalog. Looked up by an arbitrary user id from a product
  // page, so it only ever surfaces accounts that have actually published at
  // least one listing — a `USER` who has never listed anything isn't a
  // "seller" (see PRODUCT.md) and their account shouldn't be enumerable
  // through this route.
  //
  // Deliberately gated on "has ever published a listing" (any Product row
  // at all), NOT "currently has an approved one": editing any moderated
  // field of an already-approved listing flips it back to `isApproved:
  // false` pending re-review (see `update()` above), and a seller's very
  // first listing starts out pending too. Gating on current approval would
  // 404 an established seller's own profile the moment they touch their
  // price, or a new seller previewing their own pending listing — exactly
  // the accounts this page exists to serve.
  async getSellerProfile(id: string) {
    const [user, hasEverListed] = await Promise.all([
      this.prisma.client.user.findUnique({
        where: { id },
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.client.product.count({
        where: { sellerId: id },
      }),
    ]);

    if (!user || hasEverListed === 0) {
      throw new NotFoundException('Este vendedor no existe');
    }

    // Deferred until after the gate above (rather than folded into the
    // Promise.all) so a 404 lookup costs one product.count, not two — see
    // "should call product.count only once for a non-seller id" test.
    const activeListings = await this.prisma.client.product.count({
      where: { sellerId: id, ...APPROVED_UNSOLD },
    });

    return {
      id: user.id,
      name: user.name,
      memberSince: user.createdAt,
      activeListings,
    };
  }

  async getFacets() {
    const [brands, categories] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { ...APPROVED_UNSOLD, brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      this.prisma.client.product.findMany({
        where: { ...APPROVED_UNSOLD },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      }),
    ]);

    return {
      brands: brands.map((p) => p.brand).filter((b): b is string => !!b),
      categories: categories.map((p) => p.category),
    };
  }

  async findOne(id: string, requester?: { id: string; role: Role } | null) {
    // Every listing is a single physical garment, never restocked — so at
    // most one order item can ever record its actual sale. Whoever that
    // order belongs to (if it went through) is the one buyer a review can
    // count as "verified". Fired alongside the product read rather than
    // after it: this doesn't depend on the product existing, and reviews
    // are only in scope once we already know it does.
    const [product, sale] = await Promise.all([
      this.prisma.client.product.findUnique({
        where: { id },
        include: {
          seller: { select: { id: true, name: true } },
          reviews: {
            select: {
              id: true,
              rating: true,
              comment: true,
              createdAt: true,
              // Without these, the web app's own review card can never tell
              // "is this my review" from "is this someone else's" (userId),
              // and a seller's reply — already written via PATCH
              // /reviews/:id/reply — never reaches the page that is supposed
              // to display it.
              userId: true,
              sellerReply: true,
              sellerRepliedAt: true,
              user: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.client.orderItem.findFirst({
        where: {
          productId: id,
          order: { status: { in: VERIFIED_PURCHASE_STATUSES } },
        },
        select: { order: { select: { userId: true } } },
      }),
    ]);

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // Being sold removes a listing from the catalog (`findAll`/`getFacets`
    // filter on `soldAt: null`) but NOT from the web: the buyer reaches this
    // page from their order history, and it is the only place they can leave a
    // review. Hiding it 404'd those links and made the review flow
    // unreachable. Only moderation state restricts who may look.
    if (!product.isApproved) {
      const canView =
        !!requester &&
        (requester.role === Role.ADMIN || requester.id === product.sellerId);

      if (!canView) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }
    }

    // Mirrors ReviewsService.findAllByProduct's own verifiedPurchase
    // computation — this page renders reviews from this endpoint, not that
    // one, and it needs the exact same badge to be accurate here too.
    const verifiedBuyerId = sale?.order.userId;
    return {
      ...product,
      reviews: product.reviews.map((review) => ({
        ...review,
        verifiedPurchase: review.userId === verifiedBuyerId,
      })),
    };
  }

  // "Productos similares": other listings in the same category, so a buyer
  // who opens one item can keep browsing instead of bouncing back to the
  // catalog. A dedicated, lightweight endpoint rather than a field on
  // findOne's response — this is optional supplementary content the page
  // fetches independently, not something every findOne caller needs to pay
  // for (findOne is also used by SSR product-page metadata and the seller's
  // own preview of a pending listing).
  //
  // Unguarded route, no requester — unlike findOne, this never makes an
  // exception for the listing's own seller or an admin. Gating on
  // `isApproved` here (not just on the *results*, which already excluded
  // unapproved siblings) matters for the SOURCE product too: without it, a
  // pending or rejected listing's id would 404 on findOne but 200 here,
  // letting a caller confirm a hidden listing exists via a side channel.
  // The cost is that a seller previewing their own still-pending listing
  // won't see a "similar items" section — an acceptable gap, since that
  // section is a buyer-discovery aid, not something the listing's own
  // author needs while it awaits review.
  async getRelatedProducts(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      select: { category: true, isApproved: true },
    });

    if (!product || !product.isApproved) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // Exact match on the free-text `category` column: two listings entered
    // as "Chaquetas" and "chaquetas" won't match each other. A known,
    // pre-existing gap in how categories are stored app-wide (findAll's own
    // catalog filter has the same exact-match limitation) — fixing it means
    // normalizing category values at write time, out of scope here.
    const related = await this.prisma.client.product.findMany({
      where: {
        category: product.category,
        ...APPROVED_UNSOLD,
        id: { not: id },
      },
      take: RELATED_PRODUCTS_LIMIT,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, name: true } },
      },
    });

    return { data: await this.withAverageRating(related) };
  }

  async findRaw(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
    role: Role,
  ) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    if (product.sellerId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para actualizar este producto',
      );
    }

    // A sold garment is a historical record: the buyer's order detail renders the
    // live product row, so letting the seller rewrite it would change what
    // someone else's purchase history says they bought. It would also send an
    // already-shipped item back through `needsReview` below, and an unapproved
    // product can no longer be reviewed. The read above is only for the 404/403
    // checks — the write itself re-asserts `soldAt: null` for non-admins so a
    // checkout that claims the product between the read and the write still
    // gets rejected instead of silently overwriting a sold listing.
    if (product.soldAt && role !== Role.ADMIN) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no se puede editar',
      );
    }

    // An admin editing a listing is the moderator, so their edits stand.
    // A seller touching anything moderation judged sends it back to the queue,
    // and clears any previous rejection so it lands in "pendientes" again.
    const needsReview =
      role !== Role.ADMIN &&
      this.hasModeratedChanges(product, updateProductDto);

    try {
      return await this.prisma.client.product.update({
        where: {
          id,
          ...(role !== Role.ADMIN ? { soldAt: null } : {}),
        },
        data: {
          ...updateProductDto,
          ...(needsReview
            ? { isApproved: false, rejectedAt: null, rejectionReason: null }
            : {}),
        },
        include: { seller: { select: { id: true, name: true } } },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya fue vendido y no se puede editar',
          );
        },
      });
    }
  }

  async remove(id: string, userId: string, role: Role) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    if (product.sellerId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para eliminar este producto',
      );
    }

    // `OrderItem.productId` is ON DELETE RESTRICT, so deleting a product that has
    // been bought raises a raw Prisma error and, with no exception filter
    // registered, a 500. Refuse it with a Spanish 400 instead. As with update()
    // above, the read here only drives that early check — the delete itself
    // re-asserts `soldAt: null` so a checkout racing this request still can't
    // reach the foreign-key failure this guard exists to prevent.
    if (product.soldAt) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no se puede eliminar: forma parte del historial de un pedido',
      );
    }

    try {
      return await this.prisma.client.product.delete({
        where: { id, soldAt: null },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya fue vendido y no se puede eliminar: forma parte del historial de un pedido',
          );
        },
        // A CartItem, Review, or OrderItem (even from a cancelled order, which
        // clears `soldAt` back to null) can still reference this product with
        // an ON DELETE RESTRICT foreign key. Prisma raises P2003 for that
        // instead of the P2025 above, and with no handler registered it
        // reached the admin as a raw 500. Refuse it with a Spanish 400.
        P2003: () => {
          throw new BadRequestException(
            'Este producto no se puede eliminar: todavía está en un carrito, en las reseñas o favoritos de otra persona, o en un pedido.',
          );
        },
      });
    }
  }

  // Searchable across the same fields as the public catalog's findAll
  // (title, description, brand, category) so a seller with many listings
  // can find one without paging through every status tab by hand.
  async findAllMine(sellerId: string, query: any) {
    const { search, status, page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    // A seller's own dashboard has one more bucket than the admin queue:
    // "vendido" (soldAt set) sits outside isApproved/rejectedAt entirely, and
    // an approved-but-sold listing must stop showing up under "aprobados"
    // here even though admin's findAllForAdmin still counts it there (that
    // view tracks moderation history, this one tracks what's sellable).
    const where: any = { sellerId };
    if (status === 'pending') {
      where.isApproved = false;
      where.rejectedAt = null;
      where.soldAt = null;
    } else if (status === 'approved') {
      where.isApproved = true;
      where.soldAt = null;
    } else if (status === 'rejected') {
      where.isApproved = false;
      where.rejectedAt = { not: null };
    } else if (status === 'sold') {
      where.soldAt = { not: null };
    }

    if (search) {
      where.OR = this.searchTextWhere(String(search));
    }

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async findAllForAdmin(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    // Admins see everything, sold items included: an approved product that has
    // been bought stays in the "aprobados" bucket, it just left the catalog.
    const where: any = {};
    if (status === 'pending') {
      where.isApproved = false;
      where.rejectedAt = null;
    } else if (status === 'approved') {
      where.isApproved = true;
    } else if (status === 'rejected') {
      where.isApproved = false;
      where.rejectedAt = { not: null };
    }

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.client.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async approveProduct(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // A sold product is a historical record (see remove()/update() above): the
    // buyer's order detail keeps rendering it, so flipping `isApproved` on it
    // would hide it from that buyer (findOne()'s canView check only admits
    // admin/seller) and break their own "Escribir reseña" link. The read here
    // only drives this check — the write itself re-asserts `soldAt: null` so
    // a checkout racing this request still can't approve a product out from
    // under the buyer who just bought it.
    if (product.soldAt) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no se puede aprobar: forma parte del historial de un pedido',
      );
    }

    try {
      return await this.prisma.client.product.update({
        where: { id, soldAt: null },
        data: APPROVE_DATA,
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya fue vendido y no se puede aprobar: forma parte del historial de un pedido',
          );
        },
      });
    }
  }

  // A moderator working through a backlog of pending listings approves them
  // one at a time today; this lets a batch go through in a single request.
  // `updateMany` (not a loop of individual updates) re-asserts `soldAt: null`
  // in its own `where`, the same compare-and-swap approveProduct() uses, so a
  // checkout racing this request still can't have one of the selected
  // products approved out from under the buyer who just bought it — it's
  // just silently excluded from `count` instead of one request failing.
  // `isApproved: false` mirrors the frontend's own eligibility check: a
  // product another admin already approved in the meantime is excluded
  // instead of being redundantly rewritten. Requested ids are de-duplicated
  // first so a caller that (unlike this app's own Set-backed UI) submits the
  // same id twice can't make `approved` read as lower than `requested` for a
  // batch where every distinct product actually succeeded.
  async bulkApprove(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));

    const result = await this.prisma.client.product.updateMany({
      where: { id: { in: uniqueIds }, isApproved: false, soldAt: null },
      data: APPROVE_DATA,
    });

    return { approved: result.count, requested: uniqueIds.length };
  }

  async rejectProduct(id: string, reason?: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    // Same reasoning as approveProduct(): rejecting flips `isApproved` to
    // false, which findOne()'s canView check then hides from everyone but an
    // admin or the seller — including a buyer who bought this product and
    // reaches it from their own order history to leave a review.
    if (product.soldAt) {
      throw new BadRequestException(
        'Este producto ya fue vendido y no se puede rechazar: forma parte del historial de un pedido',
      );
    }

    try {
      return await this.prisma.client.product.update({
        where: { id, soldAt: null },
        data: {
          isApproved: false,
          rejectedAt: new Date(),
          rejectionReason: reason ?? null,
        },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya fue vendido y no se puede rechazar: forma parte del historial de un pedido',
          );
        },
      });
    }
  }
}
