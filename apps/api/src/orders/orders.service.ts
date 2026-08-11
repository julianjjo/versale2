import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { OrderStatus } from './order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { Role } from '../users/role.enum';

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private cartService: CartService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto = {}) {
    const cart = await this.cartService.getCart(userId);

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    let totalAmount = 0;
    const orderItems: { productId: string; quantity: number; price: number }[] =
      [];

    for (const item of cart.items) {
      const product = await this.prisma.client.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || !product.isApproved) {
        throw new BadRequestException(
          `Product ${product?.title ?? item.productId} is no longer available`,
        );
      }

      if (product.sellerId === userId) {
        throw new BadRequestException(
          `You cannot purchase your own product: ${product.title}`,
        );
      }

      if (item.quantity <= 0) {
        throw new BadRequestException(
          `Invalid quantity for product: ${product.title}`,
        );
      }

      const itemTotal = item.priceAtAdd * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        price: item.priceAtAdd,
      });
    }

    return this.prisma.client.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: OrderStatus.PENDING,
          shippingAddress: (dto.shippingAddress ?? {}) as Prisma.InputJsonValue,
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  async getUserOrders(userId: string) {
    return this.prisma.client.order.findMany({
      where: { userId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrderById(id: string, userId: string, role: Role) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    if (order.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para acceder a este pedido',
      );
    }

    return order;
  }

  async getAllOrders() {
    return this.prisma.client.order.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.prisma.client.order.update({
      where: { id },
      data: { status },
    });
  }
}
