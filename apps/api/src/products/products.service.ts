import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Role } from '../users/role.enum';

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

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

  private resolvePagination(page: unknown, limit: unknown) {
    const parsedPage = Math.floor(Number(page));
    const parsedLimit = Math.floor(Number(limit));

    const pageNum =
      Number.isFinite(parsedPage) && parsedPage >= 1 ? parsedPage : 1;
    const limitNum =
      Number.isFinite(parsedLimit) && parsedLimit >= 1
        ? Math.min(parsedLimit, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
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
      page = 1,
      limit = 10,
    } = query;
    const { pageNum, limitNum, skip } = this.resolvePagination(page, limit);

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

    // A sold product is gone for everyone except its seller and admins, who
    // still need it for order history and moderation.
    if (!product.isApproved || product.soldAt) {
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

    // An admin editing a listing is the moderator, so their edits stand.
    // A seller touching anything moderation judged sends it back to the queue,
    // and clears any previous rejection so it lands in "pendientes" again.
    const needsReview =
      role !== Role.ADMIN &&
      this.hasModeratedChanges(product, updateProductDto);

    return this.prisma.client.product.update({
      where: { id },
      data: {
        ...updateProductDto,
        ...(needsReview
          ? { isApproved: false, rejectedAt: null, rejectionReason: null }
          : {}),
      },
      include: { seller: { select: { id: true, name: true } } },
    });
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

    return this.prisma.client.product.delete({ where: { id } });
  }

  async findAllForAdmin(query: any) {
    const { status, page = 1, limit = 10 } = query;
    const { pageNum, limitNum, skip } = this.resolvePagination(page, limit);

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
    return this.prisma.client.product.update({
      where: { id },
      data: { isApproved: true, rejectedAt: null, rejectionReason: null },
    });
  }

  async rejectProduct(id: string, reason?: string) {
    return this.prisma.client.product.update({
      where: { id },
      data: {
        isApproved: false,
        rejectedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });
  }
}
