import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Role } from '../users/role.enum';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';

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

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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
      page = 1,
      limit = 10,
    } = query;
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    // Sold items are one-of-a-kind: once bought they leave the public catalog.
    const where: any = { isApproved: true, soldAt: null };

    if (search) {
      const term = String(search);
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
        { brand: { contains: term } },
        { category: { contains: term } },
      ];
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

  async getFacets() {
    const [brands, categories] = await Promise.all([
      this.prisma.client.product.findMany({
        where: { isApproved: true, soldAt: null, brand: { not: null } },
        select: { brand: true },
        distinct: ['brand'],
        orderBy: { brand: 'asc' },
      }),
      this.prisma.client.product.findMany({
        where: { isApproved: true, soldAt: null },
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
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } },
        reviews: {
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { reviews: true } },
      },
    });

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

    return product;
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
            'Este producto no se puede eliminar: todavía está en un carrito, en las reseñas de otra persona o en un pedido.',
          );
        },
      });
    }
  }

  async findAllMine(sellerId: string, query: any) {
    const { status, page = 1, limit = 10 } = query;
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
        data: { isApproved: true, rejectedAt: null, rejectionReason: null },
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
