import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto, sellerId: string) {
    return this.prisma.client.product.create({
      data: {
        ...createProductDto,
        sellerId,
      },
    });
  }

  async findAll(query: any) {
    const { search, minPrice, maxPrice, size, brand, condition, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      isApproved: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
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
      where.brand = { contains: brand, mode: 'insensitive' };
    }
    if (condition) {
      where.condition = condition;
    }

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          images: true,
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
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.client.product.findUnique({
      where: { id },
      include: {
        seller: { select: { id: true, name: true } },
        images: true,
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
      throw new Error('Not authorized to update this product');
    }

    return this.prisma.client.product.update({
      where: { id },
      data: updateProductDto,
      include: {
        seller: { select: { id: true, name: true } },
        images: true,
      },
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
      throw new Error('Not authorized to delete this product');
    }

    return this.prisma.client.product.delete({ where: { id } });
  }

  // For admin: get all products (including not approved)
  async findAllForAdmin(query: any) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      this.prisma.client.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, name: true } },
          images: true,
          _count: { select: { reviews: true } },
        },
      }),
      this.prisma.client.product.count(),
    ]);

    return {
      data: products,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    };
  }

  // For admin: approve a product
  async approveProduct(id: string) {
    return this.prisma.client.product.update({
      where: { id },
      data: { isApproved: true },
    });
  }
}
