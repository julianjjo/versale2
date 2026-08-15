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
import { translatePrismaError } from '../common/prisma-error';

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

  // A seller's own fulfillment queue: every order that includes at least one
  // of their products, newest first. `items` is filtered to just this
  // seller's own — a mixed cart's other items belong to sellers who have
  // nothing to do with this request and shouldn't see each other's listings.
  async getMySales(sellerId: string, query: any = {}) {
    const { page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where = { items: { some: { product: { sellerId } } } };

    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true } },
          items: {
            where: { product: { sellerId } },
            include: { product: { select: { id: true, title: true, images: true } } },
          },
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

  // Lets a seller mark their own sale as shipped without waiting on an admin —
  // but only when every item on the order is theirs. A cart can mix products
  // from several sellers under one order/one status, and there is no
  // per-item shipping state; letting one seller flip SHIPPED on an order that
  // also has another seller's still-unshipped item would misreport it as
  // shipped. That mixed case is refused and left for an admin to handle.
  async shipOwnSale(sellerId: string, id: string, trackingNumber?: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        items: { select: { product: { select: { sellerId: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    const sellerItemCount = order.items.filter(
      (item) => item.product.sellerId === sellerId,
    ).length;

    if (sellerItemCount === 0) {
      throw new ForbiddenException('No tienes productos en este pedido');
    }

    if (sellerItemCount !== order.items.length) {
      throw new ForbiddenException(
        'Este pedido incluye productos de otros vendedores; solo un administrador puede actualizarlo',
      );
    }

    const currentStatus = order.status as OrderStatus;
    if (currentStatus !== OrderStatus.PAID) {
      throw new BadRequestException(
        `No se puede marcar como enviado un pedido en estado ${ORDER_STATUS_LABEL[currentStatus]}`,
      );
    }

    try {
      return await this.prisma.client.order.update({
        where: { id, status: OrderStatus.PAID },
        data: {
          status: OrderStatus.SHIPPED,
          trackingNumber: trackingNumber || null,
        },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new BadRequestException(
            'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.',
          );
        },
      });
    }
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    return this.transitionStatus(order, status);
  }

  // A buyer can only ever move their own order to CANCELLED — never to any
  // other status, and never someone else's order. `updateOrderStatus` above
  // stays the unrestricted admin path; this is its ownership-checked,
  // single-target sibling, sharing the same transition table and the same
  // soldAt release so a buyer's cancellation relists the garment exactly like
  // an admin's does.
  async cancelOwnOrder(userId: string, id: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No tienes autorización para cancelar este pedido',
      );
    }

    return this.transitionStatus(order, OrderStatus.CANCELLED);
  }

  private async transitionStatus(
    order: { id: string; status: string },
    status: OrderStatus,
  ) {
    const currentStatus = order.status as OrderStatus;
    const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(status)) {
      // The enum keys stay English, but this message reaches the admin UI, so it
      // names the states the way every other label on that screen does.
      throw new BadRequestException(
        `No se puede cambiar el estado del pedido de ${ORDER_STATUS_LABEL[currentStatus]} a ${ORDER_STATUS_LABEL[status]}`,
      );
    }

    // The `status: currentStatus` clause makes this a compare-and-swap: an
    // admin shipping an order and its own buyer cancelling it can both read
    // the same pre-write status and both pass the legality check above, so
    // the write itself has to be the thing that lets only one of them
    // through — otherwise whichever request commits last wins silently,
    // either relisting a garment that already shipped or leaving a
    // cancelled order marked SHIPPED with its garment already released.
    const conflictMessage =
      'Este pedido cambió de estado mientras se procesaba tu solicitud. Actualiza la página e inténtalo de nuevo.';

    // Cancelling releases the garments the order had claimed. Checkout stamps
    // `soldAt` to take a one-of-a-kind item off the market; if the sale never
    // completes that stamp has to come back off, otherwise an abandoned
    // checkout destroys the listing for good — gone from the catalog and the
    // facets, and un-addable to any cart, with no way for the seller to relist.
    if (status !== OrderStatus.CANCELLED) {
      try {
        return await this.prisma.client.order.update({
          where: { id: order.id, status: currentStatus },
          data: { status },
        });
      } catch (error) {
        translatePrismaError(error, {
          P2025: () => {
            throw new BadRequestException(conflictMessage);
          },
        });
      }
    }

    return this.prisma.client.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true },
      });

      const updated = await tx.order
        .update({
          where: { id: order.id, status: currentStatus },
          data: { status },
        })
        .catch((error) => {
          translatePrismaError(error, {
            P2025: () => {
              throw new BadRequestException(conflictMessage);
            },
          });
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
