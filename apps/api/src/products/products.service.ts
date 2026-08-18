import {
  BadRequestException,
  Injectable,
  Logger,
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
import { logAndSwallow } from '../common/log-and-swallow';
import { VERIFIED_PURCHASE_STATUSES } from '../orders/order-status.enum';

// findOne() filters each review's helpfulVotes by this id when there's no
// logged-in requester — never a real user id, so it always yields an empty
// array instead of needing a second, conditionally-shaped Prisma query.
const NO_ANONYMOUS_VOTER_ID = '__anonymous__';

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
// hand-copy of {isApproved:true, soldAt:null, pausedAt:null} is a chance for
// the rule to drift if it ever changes. `pausedAt` is the seller's own
// temporary-hide toggle (see pauseProduct/unpauseProduct below) — orthogonal
// to moderation and to being sold, exactly like soldAt already is.
const PUBLICLY_VISIBLE = {
  isApproved: true,
  soldAt: null,
  pausedAt: null,
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
const SORT_ORDER_BY: Record<
  ProductSortBy,
  Prisma.ProductOrderByWithRelationInput[]
> = {
  [ProductSortBy.PRICE_ASC]: [{ price: 'asc' }, { id: 'asc' }],
  [ProductSortBy.PRICE_DESC]: [{ price: 'desc' }, { id: 'asc' }],
};

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private prisma: PrismaService) {}

  // Only `price` is sortable beyond the default recency order: rating is
  // computed after the page is fetched (see withAverageRating's own
  // comment on why — one groupBy for the whole page, not a column Prisma
  // could ORDER BY), so it can't be a catalog sort option without a much
  // larger restructure. An unrecognized or missing value falls back to the
  // browsing default rather than erroring, since this reads directly off
  // the query string and a stale/bookmarked URL should never 400.
  // A duplicated query key (?x=a&x=b) arrives as an array; every filter
  // below takes the first value rather than silently discarding the whole
  // filter, matching what a caller expects from repeating a query param.
  private firstValue(value: unknown): unknown {
    return Array.isArray(value) ? (value as unknown[])[0] : value;
  }

  // Unlike every other findAll filter, `ids` genuinely wants every value, not
  // just the first — a repeated query param (?ids=a&ids=b) arrives as an
  // array of individually-encoded values, while a caller building the query
  // string by hand is more likely to send one comma-separated value
  // (?ids=a,b); both are accepted so neither shape silently drops ids.
  private parseIdsFilter(value: unknown): string[] | undefined {
    const values = Array.isArray(value) ? value : [value];
    const ids = values
      .flatMap((v) => (typeof v === 'string' ? v.split(',') : []))
      .map((v) => v.trim())
      .filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  }

  // Shared by rejectProduct (single item) and bulkReject (batch): what
  // "rejecting a product" writes, in one place so the two can't drift apart
  // the way APPROVE_DATA already guards against for approve.
  private buildRejectData(reason?: string) {
    return {
      isApproved: false,
      rejectedAt: new Date(),
      rejectionReason: reason ?? null,
    };
  }

  private resolveSortOrder(
    sortBy: unknown,
  ): Prisma.ProductOrderByWithRelationInput[] {
    const value = this.firstValue(sortBy);
    if (
      value &&
      Object.values(ProductSortBy).includes(value as ProductSortBy)
    ) {
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

  async findAll(query: Record<string, unknown> = {}) {
    const {
      search: rawSearch,
      minPrice,
      maxPrice,
      size: rawSize,
      brand: rawBrand,
      category: rawCategory,
      condition: rawCondition,
      sellerId: rawSellerId,
      ids: rawIds,
      sortBy,
      page = 1,
      limit = 10,
    } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);
    const orderBy = this.resolveSortOrder(sortBy);

    const search = this.firstValue(rawSearch);
    const size = this.firstValue(rawSize);
    const brand = this.firstValue(rawBrand);
    const category = this.firstValue(rawCategory);
    const condition = this.firstValue(rawCondition);
    const sellerId = this.firstValue(rawSellerId);
    const ids = this.parseIdsFilter(rawIds);

    // Sold items are one-of-a-kind: once bought they leave the public catalog.
    const where: Prisma.ProductWhereInput = { ...PUBLICLY_VISIBLE };

    if (typeof search === 'string' && search) {
      where.OR = this.searchTextWhere(search);
    }

    // Powers a seller's public profile page (their other listings), reusing
    // the same catalog visibility rules above rather than a bespoke query —
    // a seller's profile shows exactly what any buyer could already find by
    // browsing, never a private preview of unapproved or sold stock.
    if (typeof sellerId === 'string' && sellerId) {
      where.sellerId = sellerId;
    }

    // Powers the storefront's "recently viewed" rail (a fixed set of ids,
    // most-recent-first from the visitor's own browser history): reuses the
    // same public-catalog visibility rule as every other filter here, so a
    // product that's since sold, been paused, or lost approval silently
    // drops out of the rail instead of erroring the whole batch — and,
    // unlike GET /products/:id, this path never touches `viewCount`, since
    // glancing at a thumbnail card isn't the detail-page interest that
    // counter exists to measure.
    if (ids) {
      where.id = { in: ids };
    }

    const priceFilter: Prisma.FloatFilter = {};
    if (minPrice !== undefined) priceFilter.gte = Number(minPrice);
    if (maxPrice !== undefined) priceFilter.lte = Number(maxPrice);
    if (Object.keys(priceFilter).length > 0) where.price = priceFilter;

    if (typeof size === 'string' && size) {
      where.size = size;
    }
    if (typeof brand === 'string' && brand) {
      where.brand = { contains: brand };
    }
    if (typeof category === 'string' && category) {
      where.category = category;
    }
    if (typeof condition === 'string' && condition) {
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
      where: { sellerId: id, ...PUBLICLY_VISIBLE },
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
        where: { ...PUBLICLY_VISIBLE, brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      this.prisma.client.product.findMany({
        where: { ...PUBLICLY_VISIBLE },
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
              _count: { select: { helpfulVotes: true } },
              // Filtered to the requester's own vote (rather than a plain
              // boolean field) so the same static `select` shape works
              // whether there's a logged-in requester or not: an anonymous
              // visitor's id can never match a real vote's userId, so this
              // always resolves to an empty array for them.
              helpfulVotes: {
                where: { userId: requester?.id ?? NO_ANONYMOUS_VOTER_ID },
                select: { id: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: { select: { reviews: true } },
          questions: {
            select: {
              id: true,
              productId: true,
              question: true,
              answer: true,
              answeredAt: true,
              createdAt: true,
              askerId: true,
              asker: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
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

    // Counts detail-page interest from anyone other than the product's own
    // seller — a seller re-checking their own listing isn't the signal this
    // number exists to show them. Fire-and-forget: a transient DB error here
    // must not turn an otherwise-successful product read into a failed one,
    // and a page view has no reason to wait on it.
    if (requester?.id !== product.sellerId) {
      this.prisma.client.product
        .update({
          where: { id },
          data: { viewCount: { increment: 1 } },
          // Discarded either way (fire-and-forget) — no reason to have
          // Prisma fetch and serialize the rest of the row back.
          select: { id: true },
        })
        .catch(logAndSwallow(this.logger, 'Failed to record a product view'));
    }

    // Mirrors ReviewsService.findAllByProduct's own verifiedPurchase
    // computation — this page renders reviews from this endpoint, not that
    // one, and it needs the exact same badge to be accurate here too.
    const verifiedBuyerId = sale?.order.userId;
    return {
      ...product,
      reviews: product.reviews.map((review) => {
        const { _count, helpfulVotes, ...rest } = review;
        return {
          ...rest,
          verifiedPurchase: review.userId === verifiedBuyerId,
          helpfulCount: _count.helpfulVotes,
          votedByMe: helpfulVotes.length > 0,
        };
      }),
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
        ...PUBLICLY_VISIBLE,
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

  // Lets a seller temporarily hide an otherwise-live listing from the public
  // catalog without deleting it or sending it back through re-review — e.g.
  // taking a break, or the garment is spoken for outside the site for now.
  // Shared by pauseProduct/unpauseProduct: both need the same "is this mine
  // (or am I an admin), and is it still unsold" preamble that update()/
  // remove() also repeat — kept as its own private helper (rather than
  // folding into those pre-existing, independently-tested methods) so this
  // PR's two new call sites stop duplicating it a third and fourth time.
  private async findOwnedUnsoldProduct(
    id: string,
    userId: string,
    role: Role,
    actionVerb: string,
  ) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    if (product.sellerId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        `No tienes autorización para ${actionVerb} este producto`,
      );
    }

    if (product.soldAt) {
      throw new BadRequestException(
        `Este producto ya fue vendido y no se puede ${actionVerb}`,
      );
    }

    return product;
  }

  // Gated on `isApproved` (unlike update()/remove(), which only gate on
  // soldAt): a pending or rejected listing is already invisible to buyers for
  // a stronger reason, and pausing one would leave a dangling `pausedAt` an
  // admin's later approval wouldn't explain — the seller would have to
  // separately remember to unpause a listing they never saw approved yet.
  async pauseProduct(id: string, userId: string, role: Role) {
    const product = await this.findOwnedUnsoldProduct(
      id,
      userId,
      role,
      'pausar',
    );

    if (!product.isApproved) {
      throw new BadRequestException(
        'Solo puedes pausar una publicación aprobada',
      );
    }

    try {
      // `isApproved: true` re-asserted here, not just at the read above: a
      // concurrent rejection or moderated-field edit landing between the read
      // and this write would otherwise still flip pausedAt, leaving exactly
      // the dangling paused-but-unapproved state the isApproved guard above
      // exists to prevent.
      return await this.prisma.client.product.update({
        where: { id, soldAt: null, isApproved: true },
        data: { pausedAt: new Date() },
        include: { seller: { select: { id: true, name: true } } },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya no se puede pausar: fue vendido o dejó de estar aprobado',
          );
        },
      });
    }
  }

  // The reactivate half of pauseProduct() above: no isApproved guard here,
  // since a paused-but-now-unapproved listing (the seller edited a moderated
  // field while it was paused, sending it back to review) is a valid state —
  // unpausing it just means it will be visible again once it's re-approved,
  // same as any other pending listing.
  async unpauseProduct(id: string, userId: string, role: Role) {
    await this.findOwnedUnsoldProduct(id, userId, role, 'reactivar');

    try {
      return await this.prisma.client.product.update({
        where: { id, soldAt: null },
        data: { pausedAt: null },
        include: { seller: { select: { id: true, name: true } } },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este producto ya fue vendido y no se puede reactivar',
          );
        },
      });
    }
  }

  // Same batching shape as the admin moderation bulk actions
  // (bulkApprove/bulkReject): a seller with many listings (going on
  // vacation, restocking) currently pauses them one at a time. Unlike
  // those two (admin-only, so ownership never enters their where-clause),
  // this is the first bulk action that folds an OWNERSHIP check into the
  // same silent-exclusion bucket as state (sold/unapproved/already-paused)
  // rather than throwing — a deliberate choice, not just following
  // findOwnedUnsoldProduct's precedent (which throws ForbiddenException
  // for a non-owner on the single-item path). Silent exclusion is at
  // least as private here: a prober gets no signal distinguishing "not
  // yours" from "already in that state" from "doesn't exist" in the
  // response, only that it wasn't counted.
  async bulkPause(ids: string[], userId: string, role: Role) {
    const uniqueIds = Array.from(new Set(ids));

    const where: Prisma.ProductWhereInput = {
      id: { in: uniqueIds },
      soldAt: null,
      isApproved: true,
      pausedAt: null,
    };
    if (role !== Role.ADMIN) {
      where.sellerId = userId;
    }

    const result = await this.prisma.client.product.updateMany({
      where,
      data: { pausedAt: new Date() },
    });

    return { paused: result.count, requested: uniqueIds.length };
  }

  // The reactivate half of bulkPause() above — same reasoning as
  // unpauseProduct(): no isApproved guard, since a paused-but-now-unapproved
  // listing is still valid to reactivate.
  async bulkUnpause(ids: string[], userId: string, role: Role) {
    const uniqueIds = Array.from(new Set(ids));

    const where: Prisma.ProductWhereInput = {
      id: { in: uniqueIds },
      soldAt: null,
      pausedAt: { not: null },
    };
    if (role !== Role.ADMIN) {
      where.sellerId = userId;
    }

    const result = await this.prisma.client.product.updateMany({
      where,
      data: { pausedAt: null },
    });

    return { unpaused: result.count, requested: uniqueIds.length };
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
  async findAllMine(sellerId: string, query: Record<string, unknown> = {}) {
    const { search: rawSearch, status, page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);
    const search = this.firstValue(rawSearch);

    // A seller's own dashboard has two more buckets than the admin queue:
    // "vendido" (soldAt set) and "pausado" (pausedAt set) both sit outside
    // isApproved/rejectedAt entirely, and an approved-but-sold-or-paused
    // listing must stop showing up under "aprobados" here even though
    // admin's findAllForAdmin still counts it there (that view tracks
    // moderation history, this one tracks what's actually sellable).
    const where: Prisma.ProductWhereInput = { sellerId };
    if (status === 'pending') {
      where.isApproved = false;
      where.rejectedAt = null;
      where.soldAt = null;
    } else if (status === 'approved') {
      where.isApproved = true;
      where.soldAt = null;
      where.pausedAt = null;
    } else if (status === 'rejected') {
      where.isApproved = false;
      where.rejectedAt = { not: null };
    } else if (status === 'sold') {
      where.soldAt = { not: null };
    } else if (status === 'paused') {
      where.pausedAt = { not: null };
      where.soldAt = null;
    }

    if (typeof search === 'string' && search) {
      where.OR = this.searchTextWhere(search);
    }

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          // favoritedBy/questions round out `viewCount` (a plain scalar
          // column, already included by default) into the seller's full
          // per-listing performance picture on /mis-productos.
          _count: {
            select: { reviews: true, favoritedBy: true, questions: true },
          },
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

  async findAllForAdmin(query: Record<string, unknown> = {}) {
    const { status, page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    // Admins see everything, sold items included: an approved product that has
    // been bought stays in the "aprobados" bucket, it just left the catalog.
    const where: Prisma.ProductWhereInput = {};
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
        data: this.buildRejectData(reason),
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

  // Same batching shape as bulkApprove above, for the opposite action: a
  // moderator clearing a backlog of pending listings (or taking down
  // approved ones that turned out to violate policy) currently rejects them
  // one at a time. `rejectedAt: null` in the where clause is the single
  // condition covering both states rejectProduct()'s own eligibility check
  // allows (pending or currently-approved) — an already-rejected product is
  // silently excluded instead of being redundantly rewritten with a new
  // reason/timestamp, and `soldAt: null` re-asserts the same compare-and-swap
  // as every other moderation action here.
  async bulkReject(ids: string[], reason?: string) {
    const uniqueIds = Array.from(new Set(ids));

    const result = await this.prisma.client.product.updateMany({
      where: { id: { in: uniqueIds }, rejectedAt: null, soldAt: null },
      data: this.buildRejectData(reason),
    });

    return { rejected: result.count, requested: uniqueIds.length };
  }
}
