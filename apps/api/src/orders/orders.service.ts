import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { NotificationType, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STATUS_LABEL, OrderStatus } from './order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { MAX_ITEM_QUANTITY } from '../cart/dto/cart.dto';
import { Role } from '../users/role.enum';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';
import { toCsv, withExcelCompat } from '../common/csv';
import { logAndSwallow } from '../common/log-and-swallow';
import { NotificationsService } from '../notifications/notifications.service';

// Maps a target order status to the notification "flavor" a recipient sees
// in the bell dropdown — SHIPPED/CANCELLED get their own icon-friendly type,
// every other transition (PAID, DELIVERED) falls back to the generic one.
function notificationTypeForStatus(status: OrderStatus): NotificationType {
  if (status === OrderStatus.SHIPPED) return NotificationType.ORDER_SHIPPED;
  if (status === OrderStatus.CANCELLED) {
    return NotificationType.ORDER_CANCELLED;
  }
  return NotificationType.ORDER_STATUS_CHANGED;
}

// exportOrdersCsv() has no pagination UI to bound it the way getAllOrders()
// has — it hands back every matching row in one response — so this is a hard
// technical ceiling rather than a page size, matching
// FavoritesService#findAllIds's own MAX_FAVORITE_IDS.
const MAX_EXPORT_ROWS = 5000;

// The admin export's one address column has to render the same untyped Json
// blob apps/web/src/app/cart/page.tsx's addressFieldValue() already treats
// defensively (never assume a shape, never let a non-string field like a
// pasted array reach display).
function formatShippingAddress(address: unknown): string {
  if (!address || typeof address !== 'object') return '';
  const a = address as Record<string, unknown>;
  return [a.street, a.city, a.state, a.zip, a.country]
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.trim() !== '',
    )
    .join(', ');
}

// Shared by getAllOrders() (admin) and exportOrdersCsv() — both search the
// same admin-facing order list by the same three fields, so they'd otherwise
// drift into two copies of the identical filter.
function buildOrderSearchWhere(search: unknown): Prisma.OrderWhereInput {
  if (typeof search !== 'string' || !search) return {};
  const term = search;
  return {
    OR: [
      { id: { contains: term } },
      { user: { is: { name: { contains: term } } } },
      { user: { is: { email: { contains: term } } } },
    ],
  };
}

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
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // A notification is a side effect of an order mutation that has already
  // committed — it must never turn an otherwise-successful ship/cancel/
  // status-change into a failed response just because the notification
  // insert hit a transient error.
  private async notifySafely(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      logAndSwallow(this.logger, 'Failed to send an order notification')(error);
    }
  }

  // Shared by cancelOwnOrder (buyer-initiated) and updateOrderStatus
  // (admin-initiated, when the new status is CANCELLED): every distinct
  // seller with a product on the order gets told, in one batched insert
  // rather than one round-trip per seller.
  private async notifySellersOfCancellation(order: {
    id: string;
    items: { product: { sellerId: string } }[];
  }): Promise<void> {
    const sellerIds = [
      ...new Set(order.items.map((item) => item.product.sellerId)),
    ];
    await this.notifications.createMany(
      sellerIds.map((sellerId) => ({
        userId: sellerId,
        type: NotificationType.ORDER_CANCELLED,
        message:
          'El comprador canceló un pedido que incluía uno de tus productos.',
        orderId: order.id,
      })),
    );
  }

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
        if (product.status !== ProductStatus.AVAILABLE) {
          throw new BadRequestException(
            `El producto ${product.title} ya fue vendido`,
          );
        }

        if (product.sellerId === userId) {
          throw new BadRequestException(
            `No puedes comprar tu propio producto: ${product.title}`,
          );
        }

        // Checked after the self-purchase guard so a seller who somehow has
        // their own paused listing in their cart sees the more fundamental
        // "you can't buy your own product" message, not this one.
        if (product.pausedAt) {
          throw new BadRequestException(
            `El vendedor pausó el producto ${product.title} y ya no está disponible`,
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

        // One-of-a-kind garment: whatever a stale cart row might claim, an
        // order item is written with exactly 1 unit — the DTOs and the cart
        // service already refuse more at write time, this clamp keeps a
        // hand-tampered or legacy row from minting a multi-unit line here.
        const quantity = Math.min(item.quantity, MAX_ITEM_QUANTITY);

        const itemTotal = item.priceAtAdd * quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: product.id,
          quantity,
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

      // Compare-and-swap in the same transaction: only rows still AVAILABLE
      // AND unpaused are flipped to SOLD, so if a racing checkout already
      // claimed one of them, or a seller paused one mid-checkout, the count
      // comes back short and the whole order is rolled back. Without the
      // `pausedAt: null` re-assertion here, a seller pausing a listing in the
      // window between this transaction's initial cart read and this write
      // would not stop the sale — the product would end up both sold and
      // paused, since the earlier per-item `pausedAt` check above only saw
      // the stale, pre-pause snapshot.
      const productIds = orderItems.map((item) => item.productId);
      const sold = await tx.product.updateMany({
        where: { id: { in: productIds }, status: ProductStatus.AVAILABLE, pausedAt: null },
        data: { status: ProductStatus.SOLD },
      });

      if (sold.count !== productIds.length) {
        throw new BadRequestException(
          'Alguno de los productos de tu carrito ya no está disponible (fue vendido o pausado). Actualiza tu carrito e inténtalo de nuevo',
        );
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  // A buyer's own order history: searchable (by order id or an item's
  // product title) and filterable by status, paginated the same way every
  // other list endpoint in this API is. Mirrors `getAllOrders` (admin) and
  // `getMySales` (seller) below rather than introducing a third shape.
  async getUserOrders(userId: string, query: Record<string, unknown> = {}) {
    const { search, status, page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: Prisma.OrderWhereInput = { userId };
    if (typeof search === 'string' && search) {
      const term = search;
      where.OR = [
        { id: { contains: term } },
        { items: { some: { product: { is: { title: { contains: term } } } } } },
      ];
    }
    // Validated against the enum instead of passed through as-is: Prisma
    // throws an unhandled `PrismaClientValidationError` (a raw 500, no
    // Spanish message) for a `status` filter value outside `OrderStatus`,
    // and this is a public query param a caller can set to anything.
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          // The buyer's own list card only ever shows the first item's title
          // and thumbnail (see apps/web/src/app/orders/page.tsx), the same
          // narrowing getMySales already applies for the seller's own list —
          // no reason for this one to pull every Product column instead.
          items: {
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
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

  async getAllOrders(query: Record<string, unknown> = {}) {
    const { search, page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where = buildOrderSearchWhere(search);

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

  // Mirrors getAllOrders()'s own `search` filter so "download what I'm
  // looking at" actually matches the admin's current search — but unpaged
  // (up to MAX_EXPORT_ROWS) since a CSV is meant to be the whole result set,
  // not one page of it.
  async exportOrdersCsv(query: Record<string, unknown> = {}) {
    const { search } = query ?? {};
    const where = buildOrderSearchWhere(search);

    // The admin uses this file for record-keeping and dispute resolution, so
    // a silently-truncated export would be worse than none at all — hence
    // the count alongside the capped findMany, purely to know whether to
    // warn.
    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        take: MAX_EXPORT_ROWS,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.client.order.count({ where }),
    ]);

    const csv = toCsv(orders, [
      { header: 'ID', value: (o) => o.id },
      { header: 'Comprador', value: (o) => o.user?.name },
      { header: 'Correo', value: (o) => o.user?.email },
      { header: 'Estado', value: (o) => ORDER_STATUS_LABEL[o.status] },
      { header: 'Total', value: (o) => o.totalAmount },
      { header: 'Productos', value: (o) => o._count.items },
      {
        header: 'Dirección de envío',
        value: (o) => formatShippingAddress(o.shippingAddress),
      },
      { header: 'Guía de envío', value: (o) => o.trackingNumber },
      { header: 'Creado', value: (o) => o.createdAt.toISOString() },
    ]);

    // `orderBy: createdAt desc` means a truncation always drops the OLDEST
    // matches — exactly the ones a months-old dispute would need — so the
    // warning has to name the gap, not just gesture at "there's more".
    const notice =
      total > MAX_EXPORT_ROWS
        ? `Mostrando los ${MAX_EXPORT_ROWS} pedidos más recientes de ${total} que coinciden con la búsqueda. Refina la búsqueda para ver el resto.\r\n`
        : '';

    return withExcelCompat(notice + csv);
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
  // Searchable (by order id, buyer name, or one of the seller's own product
  // titles) and filterable by status, mirroring getUserOrders (buyer) and
  // getAllOrders (admin) rather than introducing a third filtering shape.
  async getMySales(sellerId: string, query: Record<string, unknown> = {}) {
    const { search, status, page, limit } = query ?? {};
    const { pageNum, limitNum, skip } = resolvePagination(page, limit);

    const where: Prisma.OrderWhereInput = {
      items: { some: { product: { sellerId } } },
    };
    if (typeof search === 'string' && search) {
      const term = search;
      where.OR = [
        { id: { contains: term } },
        { user: { is: { name: { contains: term } } } },
        // Scoped to `sellerId` too, not just `title`: otherwise a title match
        // on another seller's item in a mixed-cart order would surface an
        // order that has nothing to do with this seller's own listing.
        {
          items: {
            some: { product: { is: { sellerId, title: { contains: term } } } },
          },
        },
      ];
    }
    // Validated against the enum for the same reason as getUserOrders: an
    // out-of-enum value would otherwise reach Prisma and raise an unhandled
    // PrismaClientValidationError instead of just matching nothing.
    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true } },
          items: {
            where: { product: { sellerId } },
            include: {
              product: { select: { id: true, title: true, images: true } },
            },
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
        userId: true,
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

    let updated;
    try {
      updated = await this.prisma.client.order.update({
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

    // The buyer, not the seller who just shipped it — this is the whole
    // point of the notification. Kept outside the try/catch above so a
    // notification failure is never mistaken for the order-conflict error
    // that catch exists to translate.
    await this.notifySafely(() =>
      this.notifications.create(
        order.userId,
        NotificationType.ORDER_SHIPPED,
        trackingNumber
          ? `Tu pedido fue enviado. Número de guía: ${trackingNumber}`
          : 'Tu pedido fue enviado.',
        order.id,
      ),
    );

    return updated;
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        userId: true,
        items: { select: { product: { select: { sellerId: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    const updated = await this.transitionStatus(order, status);

    // An admin-driven change reaches the buyer, whatever the new status is —
    // ship/cancel below have their own, more specific messages for their own
    // (self-service) paths.
    await this.notifySafely(() =>
      this.notifications.create(
        order.userId,
        notificationTypeForStatus(status),
        `Tu pedido cambió de estado a ${ORDER_STATUS_LABEL[status]}.`,
        order.id,
      ),
    );

    // An admin cancelling an order is the same event a buyer's own
    // cancellation is, from a seller's point of view — mirror
    // cancelOwnOrder's seller notification here too, or a seller only ever
    // hears about a cancellation the buyer triggered themselves.
    if (status === OrderStatus.CANCELLED) {
      await this.notifySafely(() => this.notifySellersOfCancellation(order));
    }

    return updated;
  }

  // A buyer can only ever move their own order to CANCELLED — never to any
  // other status, and never someone else's order. `updateOrderStatus` above
  // stays the unrestricted admin path; this is its ownership-checked,
  // single-target sibling, sharing the same transition table and the same
  // status release so a buyer's cancellation relists the garment exactly like
  // an admin's does.
  async cancelOwnOrder(userId: string, id: string) {
    const order = await this.prisma.client.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        items: { select: { product: { select: { sellerId: true } } } },
      },
    });

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${id}`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No tienes autorización para cancelar este pedido',
      );
    }

    const updated = await this.transitionStatus(order, OrderStatus.CANCELLED);

    // The seller(s), not the buyer who just cancelled.
    await this.notifySafely(() => this.notifySellersOfCancellation(order));

    return updated;
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
    // `status: SOLD` to take a one-of-a-kind item off the market; if the sale never
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
        // Conditional on SOLD, not unconditional: only the garments THIS order
        // claimed get relisted. Once roadmap 1.3 wires WITHDRAWN (a seller's
        // definitive takedown), an unconditional flip back to AVAILABLE would
        // resurrect listings the seller deliberately withdrew — the status
        // guard keeps cancellation scoped to what checkout actually sold.
        await tx.product.updateMany({
          where: {
            id: { in: items.map((item) => item.productId) },
            status: ProductStatus.SOLD,
          },
          data: { status: ProductStatus.AVAILABLE },
        });
      }

      return updated;
    });
  }
}
