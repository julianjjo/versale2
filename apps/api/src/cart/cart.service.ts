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
    return this.prisma.client.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
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

  async addItem(userId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un número entero positivo',
      );
    }

    const cart = await this.getCart(userId);

    const product = await this.productsService.findRaw(productId);
    if (!product.isApproved) {
      throw new BadRequestException(
        'El producto no está aprobado para la venta',
      );
    }

    return this.prisma.client.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity } },
      create: {
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
      throw new BadRequestException(
        'La cantidad debe ser un número entero positivo',
      );
    }

    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!cartItem) {
      throw new NotFoundException(
        `No se encontró el producto del carrito con ID ${cartItemId}`,
      );
    }

    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new ForbiddenException(
        'No tienes autorización para actualizar este producto del carrito',
      );
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
      throw new NotFoundException(
        `No se encontró el producto del carrito con ID ${cartItemId}`,
      );
    }

    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new ForbiddenException(
        'No tienes autorización para eliminar este producto del carrito',
      );
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
