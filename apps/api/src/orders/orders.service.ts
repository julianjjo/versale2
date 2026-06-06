import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { OrderStatus } from '../users/role.enum';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
  ) {}

  async createOrder(userId: string) {
    // Get the user's cart
    const cart = await this.cartService.getCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate total amount and prepare order items
    let totalAmount = 0;
    const orderItems = [];

    for (const item of cart.items) {
      // Ensure the product still exists and is approved
      const product = await this.prisma.client.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || !product.isApproved) {
        throw new Error(`Product ${product?.title} is no longer available`);
      }

      const itemTotal = product.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price, // price at the time of order
      });
    }

    // Create the order
    const order = await this.prisma.client.order.create({
      data: {
        userId,
        totalAmount,
        status: 'PENDING',
        shippingAddress: {}, // empty JSON object, as it's required
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              // Note: images is a Json field and is returned by default
            },
          },
        },
      },
    });

    // Clear the cart after creating the order
    await this.cartService.clearCart(userId);

    return order;
  }

  async getUserOrders(userId: string) {
    return this.prisma.client.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              // Note: images is a Json field and is returned by default
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string, userId: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              // Note: images is a Json field and is returned by default
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Ensure the order belongs to the user (unless admin, but we'll handle that in the controller)
    if (order.userId !== userId) {
      throw new Error('Not authorized to access this order');
    }

    return order;
  }

  // Admin: get all orders
  async getAllOrders() {
    return this.prisma.client.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: {
              // Note: images is a Json field and is returned by default
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: update order status
  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.prisma.client.order.update({
      where: { id },
      data: { status },
    });
  }
}
