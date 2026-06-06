import { Injectable, NotFoundException } from '@nestjs/common';
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
              include: {
                seller: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      // Create a cart if it doesn't exist
      cart = await this.prisma.client.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  seller: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
    }

    return cart;
  }

  async addItem(userId: string, productId: string, quantity: number) {
    // First, get the cart for the user
    const cart = await this.getCart(userId);

    // Check if the product exists and is approved
    const product = await this.productsService.findOne(productId);
    if (!product.isApproved) {
      throw new Error('Product is not approved for sale');
    }

    // Check if the item already exists in the cart
    const existingItem = cart.items.find((item) => item.productId === productId);

    if (existingItem) {
      // Update the quantity
      return this.prisma.client.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: {
          product: {
            include: {
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });
    } else {
      // Create a new cart item
      return this.prisma.client.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
          priceAtAdd: product.price, // snapshot of the price at the time of adding
        },
        include: {
          product: {
            include: {
              seller: { select: { id: true, name: true } },
            },
          },
        },
      });
    }
  }

  async updateItem(cartItemId: string, quantity: number, userId: string) {
    // First, get the cart item and ensure it belongs to the user's cart
    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found`);
    }

    // Verify that the cart item belongs to the user's cart
    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new Error('Not authorized to update this cart item');
    }

    // Update the quantity
    return this.prisma.client.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: {
        product: {
          include: {
            seller: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async removeItem(cartItemId: string, userId: string) {
    // First, get the cart item and ensure it belongs to the user's cart
    const cartItem = await this.prisma.client.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${cartItemId} not found`);
    }

    // Verify that the cart item belongs to the user's cart
    const cart = await this.getCart(userId);
    if (cartItem.cartId !== cart.id) {
      throw new Error('Not authorized to remove this cart item');
    }

    // Remove the cart item
    return this.prisma.client.cartItem.delete({ where: { id: cartItemId } });
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    await this.prisma.client.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { success: true };
  }
}
