import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  async getCart(userId: string) {
    let cart = await this.prisma.client.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { seller: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.client.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { seller: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async addItem(userId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const cart = await this.getCart(userId);

    const product = await this.productsService.findOne(productId);
    if (!product.isApproved) {
      throw new BadRequestException('Product is not approved for sale');
    }

    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      return this.prisma.client.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: {
          product: {
            include: { seller: { select: { id: true, name: true } } },
          },
        },
      });
    }

    return this.prisma.client.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        priceAtAdd: product.price,
      },
      include: {
        product: {
          include: { seller: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async updateItem(cartItemId: string, quantity: number, userId: string) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('Quantity must be a positive integer');
    }

    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found`);
    }

    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new ForbiddenException('Not authorized to update this cart item');
    }

    return this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: {
        product: {
          include: { seller: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async removeItem(cartItemId: string, userId: string) {
    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found`);
    }

    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new ForbiddenException('Not authorized to remove this cart item');
    }

    return this.prisma.client.cartItem.delete({ where: { id: cartItemId } });
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    await this.prisma.client.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
    return { success: true };
  }
}
