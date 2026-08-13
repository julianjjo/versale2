import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STATUS_LABEL, OrderStatus } from './order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { MAX_ITEM_QUANTITY } from '../cart/dto/cart.dto';
import { Role } from '../users/role.enum';
import { resolvePagination } from '../common/pagination';

// Legal moves of the order lifecycle. DELIVERED and CANCELLED are terminal, and
// an order can only be cancelled while it has not shipped yet.
const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// Only these statuses represent money actually received. PENDING is an order
// that was placed but never paid, and CANCELLED was never charged: neither is
// revenue. This mirrors the semantics the admin dashboard used to compute
// client-side.
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    // The global ValidationPipe already rejects a missing address, but guard
    // here too so a direct service call can never persist an empty one.
    const address = dto?.shippingAddress;
    if (!address) {
      throw new BadRequestException('La dirección de envío es obligatoria');
    }

    const { street, city, state, zip, country } = address;

    return this.prisma.client.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Tu carrito está vacío');
      }

      let totalAmount = 0;
      const orderItems: {
        productId: string;
        quantity: number;
        price: number;
      }[] = [];

      for (const item of cart.items) {
        const product = item.product;

        if (!product || !product.isApproved) {
          throw new BadRequestException(
            `El producto ${product?.title ?? item.productId} ya no está disponible`,
          );
        }

        // Re-checked inside the transaction so two concurrent checkouts of the
        // same one-of-a-kind garment cannot both succeed.
        if (product.soldAt) {
          throw new BadRequestException(
            `El producto ${product.title} ya fue vendido`,
          );
        }

        if (product.sellerId === userId) {
          throw new BadRequestException(
            `No puedes comprar tu propio producto: ${product.title}`,
          );
        }

        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          throw new BadRequestException(
            `Cantidad inválida para el producto: ${product.title}`,
          );
        }

        if (item.quantity > MAX_ITEM_QUANTITY) {
          throw new BadRequestException(
            `Cada prenda es única: solo hay ${MAX_ITEM_QUANTITY} unidad de ${product.title}`,
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

      const order = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: OrderStatus.PENDING,
          shippingAddress: {
            street,
            city,
            state: state ?? '',
            zip: zip ?? '',
            country,
          },
          items: { create: orderItems },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      // Compare-and-swap in the same transaction: only rows that are still
      // unsold are flipped, so if a racing checkout already claimed one of them
      // the count comes back short and the whole order is rolled back.
      const productIds = orderItems.map((item) => item.productId);
      const sold = await tx.product.updateMany({
        where: { id: { in: productIds }, soldAt: null },
        data: { soldAt: new Date() },
      });

      if (sold.count !== productIds.length) {
        throw new BadRequestException(
          'Alguno de los productos de tu carrito acaba de ser vendido. Actualiza tu carrito e inténtalo de nuevo',
        );
      }

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
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    if (order.userId !== userId && role !== Role.ADMIN) {
      throw new ForbiddenException(
        'No tienes autorización para acceder a este pedido',
      );
    }

    return order;
  }

  async getAllOrders(query: any = {}) {
    const { search, page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: any = {};
    if (search) {
      const term = String(search);
      where.OR = [
        { id: { contains: term } },
        { user: { is: { name: { contains: term } } } },
        { user: { is: { email: { contains: term } } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    };
  }

  // Dashboard totals, aggregated by the database. The admin overview used to
  // pull a page of orders and add up `totalAmount` in the browser, which both
  // shipped every order (with items and products) over the wire and silently
  // under-reported revenue past the first page.
  async getOrderStats() {
    const grouped = await this.prisma.client.order.groupBy({
      by: ['status'],
      _sum: { totalAmount: true },
      _count: true,
    });

    let totalOrders = 0;
    let confirmedRevenue = 0;
    let pendingRevenue = 0;

    for (const row of grouped) {
      const status = row.status as OrderStatus;
      // A status with no rows never appears here, but `_sum.totalAmount` is
      // also null whenever the group sums to nothing — coalesce either way.
      const amount = row._sum?.totalAmount ?? 0;
      totalOrders += row._count ?? 0;

      if (PAID_STATUSES.includes(status)) {
        confirmedRevenue += amount;
      } else if (status === OrderStatus.PENDING) {
        pendingRevenue += amount;
      }
      // CANCELLED counts toward the order total but toward neither revenue.
    }

    return { totalOrders, confirmedRevenue, pendingRevenue };
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    const currentStatus = order.status as OrderStatus;
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(status)) {
      // The enum keys stay English, but this message reaches the admin UI, so it
      // names the states the way every other label on that screen does.
      throw new BadRequestException(
        `No se puede cambiar el estado del pedido de ${ORDER_STATUS_LABEL[currentStatus]} a ${ORDER_STATUS_LABEL[status]}`,
      );
    }

    // Cancelling releases the garments the order had claimed. Checkout stamps
    // `soldAt` to take a one-of-a-kind item off the market; if the sale never
    // completes that stamp has to come back off, otherwise an abandoned
    // checkout destroys the listing for good — gone from the catalog and the
    // facets, and un-addable to any cart, with no way for the seller to relist.
    if (status !== OrderStatus.CANCELLED) {
      return this.prisma.client.order.update({
        where: { id },
        data: { status },
      });
    }

    return this.prisma.client.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { productId: true },
      });

      const updated = await tx.order.update({
        where: { id },
        data: { status },
      });

      if (items.length > 0) {
        await tx.product.updateMany({
          where: { id: { in: items.map((item) => item.productId) } },
          data: { soldAt: null },
        });
      }

      return updated;
    });
  }
}
