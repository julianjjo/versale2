import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { NotificationType, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ORDER_STATUS_LABEL, OrderStatus } from './order-status.enum';
import { CreateOrderDto } from './dto/create-order.dto';
import { MAX_ITEM_QUANTITY } from '../cart/dto/cart.dto';
import { Role } from '@prisma/client';
import { resolvePagination } from '../common/pagination';
import { translatePrismaError } from '../common/prisma-error';
import { toCsv, withExcelCompat } from '../common/csv';
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
  // Item 12: REFUNDED from PAID is the 7-day unshipped timeout — the cron
  // path. A buyer's own cancellation stays the manual alternative.
  [OrderStatus.PAID]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  // Item 12: a delivered order can enter dispute (buyer, within 48h); the
  // admin resolution either refunds or rejects back to DELIVERED.
  [OrderStatus.DELIVERED]: [OrderStatus.DISPUTED],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.DELIVERED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

// Item 12 deadlines (roadmap 2.2, closed decisions).
export const UNSHIPPED_REFUND_DAYS = 7;
export const DISPUTE_WINDOW_HOURS = 48;
export const DISPUTE_EXPIRY_DAYS = 30;

// createOrder() stamps the garment SOLD in the same transaction that creates
// the PENDING order, before any payment is confirmed — there is no payment
// gateway in this codebase yet, "Pagar" just creates the order, and the only
// path from PENDING to PAID is an admin's manual PATCH (orders.controller's
// updateOrderStatus, @Roles(ADMIN)), presumably after confirming an
// out-of-band payment. With no timeout at all a single abandoned checkout
// locks a one-of-a-kind garment off the market forever. But the timeout has
// to stay long enough that it (almost) never races that manual admin
// confirmation — a short window would silently cancel and relist garments
// buyers already paid for, just because an admin hadn't gotten to it yet
// (nights, weekends, queue backlog). 24h is closer to UNSHIPPED_REFUND_DAYS'
// "a human needs realistic time to act" reasoning than to a payment-gateway
// abandonment timeout; revisit downward once PAID can be confirmed
// automatically instead of by hand.
export const PENDING_ORDER_TIMEOUT_MINUTES = 24 * 60;

// Without a payment gateway, creating an order is free and instantly locks
// every item in it as SOLD for up to PENDING_ORDER_TIMEOUT_MINUTES (see
// above) — a buyer who never pays can otherwise repeat cart+checkout against
// arbitrarily many listings and take the whole catalog off the market for a
// day at a time, for free, indefinitely. A legitimate buyer essentially never
// has more than one or two orders genuinely awaiting an admin's manual
// payment confirmation at once, so this cap is a cheap, low-collateral brake
// on that abuse until real payment confirmation exists.
export const MAX_PENDING_ORDERS_PER_BUYER = 3;

// Only these statuses represent money actually received (and still held —
// REFUNDED was received too, but already given back, so it's excluded here
// on purpose). PENDING is an order that was placed but never paid, and
// CANCELLED was never charged: neither is revenue. DISPUTED is a DELIVERED
// order the buyer flagged — the payment hasn't been returned yet, it's just
// awaiting resolution, so it stays counted as confirmed until that changes
// (to REFUNDED, if the dispute is upheld). This mirrors the semantics the
// admin dashboard used to compute client-side.
const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.DISPUTED,
];

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private sweepInterval?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Hourly sweeps — native interval, no @nestjs/schedule needed
    this.sweepInterval = setInterval(
      () => {
        void this.runOrderDeadlineSweeps();
      },
      60 * 60 * 1000,
    );
    void this.runOrderDeadlineSweeps();
    // Allow process to exit even if interval is still scheduled (tests, e2e)
    if (this.sweepInterval.unref) this.sweepInterval.unref();
  }

  onModuleDestroy() {
    if (this.sweepInterval) clearInterval(this.sweepInterval);
  }

  // A notification is a side effect of an order mutation that has already
  // committed — it must never turn an otherwise-successful ship/cancel/
  // status-change into a failed response just because the notification
  // insert hit a transient error.
  private async notifySafely(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.error('Failed to send an order notification', error as Error);
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

      const pendingCount = await tx.order.count({
        where: { userId, status: OrderStatus.PENDING },
      });
      if (pendingCount >= MAX_PENDING_ORDERS_PER_BUYER) {
        throw new BadRequestException(
          'Ya tienes pedidos pendientes de pago. Espera a que se confirmen o venzan antes de crear uno nuevo',
        );
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
        where: {
          id: { in: productIds },
          status: ProductStatus.AVAILABLE,
          pausedAt: null,
        },
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
  async getUserOrders(userId: string, query: unknown = {}) {
    const q =
      query !== null && typeof query === 'object' && !Array.isArray(query)
        ? (query as Record<string, unknown>)
        : {};
    const { search, status, page, limit } = q;
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

  async getAllOrders(query: unknown = {}) {
    const q =
      query !== null && typeof query === 'object' && !Array.isArray(query)
        ? (query as Record<string, unknown>)
        : {};
    const { search, page, limit } = q;
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
  async exportOrdersCsv(query: unknown = {}) {
    const q =
      query !== null && typeof query === 'object' && !Array.isArray(query)
        ? (query as Record<string, unknown>)
        : {};
    const { search } = q;
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
  async getMySales(sellerId: string, query: unknown = {}) {
    const q =
      query !== null && typeof query === 'object' && !Array.isArray(query)
        ? (query as Record<string, unknown>)
        : {};
    const { search, status, page, limit } = q;
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

    // Item 12/13 (decisión cerrada 2.3): la transición a SHIPPED es del
    // vendedor dueño de los productos (`mine/sales/:id/ship`). El admin
    // conserva todas las demás transiciones y solo puede enviar por su
    // cuenta pedidos mixtos (varios vendedores), donde ningún vendedor
    // individual podría hacerlo.
    if (status === OrderStatus.SHIPPED) {
      const sellerIds = new Set(
        order.items.map((item) => item.product.sellerId),
      );
      const isMixedSellerOrder = sellerIds.size > 1;
      if (!isMixedSellerOrder) {
        throw new ForbiddenException(
          'Marcar el envío es responsabilidad del vendedor dueño del pedido',
        );
      }
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
    // Item 12: deadline stamps — the cron measures the 7-day unshipped
    // timeout from paidAt and the 48h dispute window from deliveredAt.
    const deadlineStamps: Prisma.OrderUpdateInput = {};
    if (status === OrderStatus.PAID) deadlineStamps.paidAt = new Date();
    if (status === OrderStatus.DELIVERED)
      deadlineStamps.deliveredAt = new Date();
    // Salir de DISPUTED cierra la disputa — por reembolso o por rechazo —
    // venga del admin o del cron: el histórico de "una por orden" queda
    // sellado en ambos caminos.
    if (currentStatus === OrderStatus.DISPUTED) {
      deadlineStamps.disputeResolvedAt = new Date();
    }

    // REFUNDED releases the garments exactly like a cancellation does: the
    // sale didn't happen (or was undone), so the one-of-a-kind listing goes
    // back on the market.
    const releasesGarments =
      status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED;

    if (!releasesGarments) {
      try {
        return await this.prisma.client.order.update({
          where: { id: order.id, status: currentStatus },
          data: { status, ...deadlineStamps },
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
          data: { status, ...deadlineStamps },
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

  // ── Item 12: disputas y reembolsos ────────────────────────────────────────

  /**
   * Buyer opens THE dispute for a delivered order. Roadmap-closed rules:
   * one dispute per order (ever — `disputedAt` stays set after resolution),
   * only within DISPUTE_WINDOW_HOURS of delivery, photos mandatory.
   */
  async openDispute(
    userId: string,
    orderId: string,
    dto: { reason: string; photos: string[] },
  ) {
    // Tipado explícito con el enum local: la comparación de estados contra
    // el enum del runtime de Prisma dispara no-unsafe-enum-comparison.
    const order = (await this.prisma.client.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        deliveredAt: true,
        disputedAt: true,
        items: { select: { product: { select: { sellerId: true } } } },
      },
    })) as {
      id: string;
      userId: string;
      status: OrderStatus;
      deliveredAt: Date | null;
      disputedAt: Date | null;
      items: { product: { sellerId: string } }[];
    } | null;

    if (!order) {
      throw new NotFoundException(`No se encontró el pedido con ID ${orderId}`);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException(
        'No tienes autorización para disputar este pedido',
      );
    }
    // Una sola por orden, incluso después de resuelta: debe revisarse antes
    // del estado para que una duplicada en DISPUTED/REFUNDED devuelva 409 y
    // no 400 por "no está entregado".
    if (order.disputedAt) {
      throw new ConflictException(
        'Este pedido ya tuvo una disputa; no se pueden abrir más',
      );
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Solo puedes disputar pedidos entregados');
    }
    // Fotos obligatorias: sin evidencia la disputa no es revisable. El DTO ya
    // lo exige; el servicio no confía en quién lo llame.
    if (!dto.photos || dto.photos.length === 0) {
      throw new BadRequestException(
        'Adjunta al menos una foto como evidencia de la disputa',
      );
    }
    if (
      !order.deliveredAt ||
      Date.now() - order.deliveredAt.getTime() >
        DISPUTE_WINDOW_HOURS * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        `La ventana para disputar es de ${DISPUTE_WINDOW_HOURS} horas desde la entrega`,
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + DISPUTE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    // CAS on DELIVERED: two concurrent dispute posts can't both win. The
    // `disputedAt` check above already rejects the common case, but it reads
    // a snapshot taken before this write — a second submission racing in the
    // gap between that read and this update still reaches here, and without
    // the try/catch below its loss would surface as an unhandled Prisma
    // P2025 (a raw 500) instead of the same Spanish conflict message,
    // mirroring how shipOwnSale/transitionStatus already handle this same
    // race on their own CAS updates.
    let updated;
    try {
      updated = await this.prisma.client.order.update({
        where: { id: orderId, status: OrderStatus.DELIVERED },
        data: {
          status: OrderStatus.DISPUTED,
          disputedAt: now,
          disputeExpiresAt: expiresAt,
          disputeReason: dto.reason,
          disputePhotos: dto.photos,
        },
      });
    } catch (error) {
      translatePrismaError(error, {
        P2025: () => {
          throw new ConflictException(
            'Este pedido ya tuvo una disputa; no se pueden abrir más',
          );
        },
      });
    }

    await this.notifySafely(() =>
      Promise.all(
        order.items
          .map((item) => item.product.sellerId)
          .filter((sellerId, idx, all) => all.indexOf(sellerId) === idx)
          .map((sellerId) =>
            this.notifications.create(
              sellerId,
              NotificationType.ORDER_STATUS_CHANGED,
              'El comprador abrió una disputa sobre su pedido. Un administrador la revisará.',
              updated.id,
            ),
          ),
      ),
    );

    return updated;
  }

  // ponytail: 3× loop dedup into helper, split into per-status sweepers if drift needs isolation
  /**
   * Sweeps stale orders matching `where` into `toStatus`.
   * Returns number of orders attempted (findMany count), not just successes.
   * Paginates with cursor (500/batch) so a large backlog after an outage
   * doesn't OOM by loading every stale row into one array.
   */
  private async sweepOrders(opts: {
    where: Prisma.OrderWhereInput;
    toStatus: OrderStatus;
    notification: { type: NotificationType; message: string };
    warnPrefix: string;
  }): Promise<number> {
    const BATCH_SIZE = 500;
    let cursor: string | undefined;
    let total = 0;

    // Deliberately sequential, not Promise.allSettled: transitionStatus's
    // releasesGarments branch opens a real $transaction, and this repo's
    // actual driver (@prisma/adapter-better-sqlite3 — one physical
    // connection) serializes EVERY transaction behind a single process-wide
    // mutex (PrismaBetterSqlite3Adapter#mutex, acquired in startTransaction()
    // before BEGIN and held until commit/rollback). Firing many of these at
    // once doesn't buy real concurrency — better-sqlite3 still executes them
    // one at a time — it only makes Prisma's own transaction-acquisition
    // timeout (maxWait, 2s by default) start ticking for every queued order
    // simultaneously instead of only once each order's turn actually comes
    // up. On a large enough backlog (an outage, or the sweep having been
    // down a while — precisely the scenario a parallel version was meant to
    // help), that timeout ceiling gets hit for orders near the back of the
    // queue, so a "parallel" sweep can clear FEWER orders per run than this
    // plain sequential loop, not more. Revisit if this ever moves off SQLite
    // to a database with real multi-connection write concurrency.
    // Cursor pagination keeps memory bounded: each batch is processed before
    // the next is fetched, instead of loading every stale row at once.
    // eslint-disable-next-line no-constant-condition -- intentional cursor pagination loop, breaks on empty/short batch
    while (true) {
      let batch: { id: string; userId: string; status: OrderStatus }[] = [];
      try {
        const rows = await this.prisma.client.order.findMany({
          where: opts.where,
          select: { id: true, userId: true, status: true },
          take: BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
          orderBy: { id: 'asc' },
        });
        batch = rows as unknown as typeof batch;
      } catch (e) {
        this.logger.error(`${opts.warnPrefix} findMany failed`, e as Error);
        return total;
      }

      if (batch.length === 0) break;
      total += batch.length;

      for (const order of batch) {
        try {
          await this.transitionStatus(order, opts.toStatus);
          await this.notifySafely(() =>
            this.notifications.create(
              order.userId,
              opts.notification.type,
              opts.notification.message,
              order.id,
            ),
          );
        } catch (error) {
          // One stale order failing (e.g. raced by an admin) must not abort the sweep over the rest.
          this.logger.warn(`${opts.warnPrefix} ${order.id}:`, error as Error);
        }
      }

      if (batch.length < BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }
    return total;
  }

  /**
   * Cron sweep (hourly): PAID orders unshipped for UNSHIPPED_REFUND_DAYS are
   * auto-refunded — the seller vanished. Public for direct testability.
   * Returns how many orders were refunded.
   */
  async autoRefundUnshippedPaidOrders(): Promise<number> {
    const cutoff = new Date(
      Date.now() - UNSHIPPED_REFUND_DAYS * 24 * 60 * 60 * 1000,
    );
    return this.sweepOrders({
      where: { status: OrderStatus.PAID, paidAt: { lte: cutoff } },
      toStatus: OrderStatus.REFUNDED,
      notification: {
        type: NotificationType.ORDER_STATUS_CHANGED,
        message:
          'Tu pago fue reembolsado automáticamente: el vendedor no envió el pedido en 7 días.',
      },
      warnPrefix: 'No se pudo reembolsar automáticamente el pedido',
    });
  }

  /**
   * Cron sweep (hourly): disputes open past DISPUTE_EXPIRY_DAYS resolve to
   * REFUNDED — the roadmap's "último recurso" favors the buyer when the admin
   * didn't act in time. Returns how many disputes were expired.
   */
  async autoResolveExpiredDisputes(): Promise<number> {
    return this.sweepOrders({
      where: {
        status: OrderStatus.DISPUTED,
        disputeExpiresAt: { lte: new Date() },
      },
      toStatus: OrderStatus.REFUNDED,
      notification: {
        type: NotificationType.ORDER_STATUS_CHANGED,
        message:
          'Tu disputa expiró sin resolución y se reembolsó tu pago automáticamente.',
      },
      warnPrefix: 'No se pudo expirar la disputa del pedido',
    });
  }

  /**
   * Cron sweep: PENDING orders older than PENDING_ORDER_TIMEOUT_MINUTES are
   * auto-cancelled — the checkout was abandoned (or, once a real payment
   * gateway exists, never confirmed). Releases the garment(s) back to
   * AVAILABLE the same way any other cancellation does. Public for direct
   * testability. Returns how many orders were cancelled.
   */
  async autoCancelStalePendingOrders(): Promise<number> {
    const cutoff = new Date(
      Date.now() - PENDING_ORDER_TIMEOUT_MINUTES * 60 * 1000,
    );
    return this.sweepOrders({
      where: { status: OrderStatus.PENDING, createdAt: { lte: cutoff } },
      toStatus: OrderStatus.CANCELLED,
      notification: {
        type: NotificationType.ORDER_CANCELLED,
        message:
          'Tu pedido se canceló automáticamente por falta de confirmación de pago. El producto volvió a estar disponible.',
      },
      warnPrefix: 'No se pudo cancelar automáticamente el pedido pendiente',
    });
  }

  async runOrderDeadlineSweeps() {
    await this.autoCancelStalePendingOrders();
    await this.autoRefundUnshippedPaidOrders();
    await this.autoResolveExpiredDisputes();
  }
}
