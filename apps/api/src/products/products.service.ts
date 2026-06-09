import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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

  async findAll(query: Record<string, unknown>) {
    const {
      search,
      minPrice,
      maxPrice,
      size,
      brand,
      condition,
      page = 1,
      limit = 10,
    } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProductWhereInput = { isApproved: true };
    const priceFilter: { gte?: number; lte?: number } = {};

    if (typeof search === 'string') {
      const term = search;
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
        { brand: { contains: term } },
        { category: { contains: term } },
      ];
    }

    if (minPrice !== undefined) {
      priceFilter.gte = Number(minPrice);
    }
    if (maxPrice !== undefined) {
      priceFilter.lte = Number(maxPrice);
    }
    if (Object.keys(priceFilter).length > 0) {
      where.price = priceFilter;
    }
    if (typeof size === 'string') {
      where.size = size;
    }
    if (typeof brand === 'string') {
      where.brand = { contains: brand };
    }
    if (typeof condition === 'string') {
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
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: string) {
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
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto, userId: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (product.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to update this product');
    }

    return this.prisma.client.product.update({
      where: { id },
      data: { ...updateProductDto },
      include: { seller: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    if (product.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to delete this product');
    }

    return this.prisma.client.product.delete({ where: { id } });
  }

  async findAllForAdmin(query: Record<string, unknown>) {
    const { page = 1, limit = 10 } = query;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.client.product.count(),
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
      data: { isApproved: true },
    });
  }
}
