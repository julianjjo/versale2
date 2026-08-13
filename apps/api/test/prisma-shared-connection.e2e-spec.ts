import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CartModule } from '../src/cart/cart.module';
import { OrdersModule } from '../src/orders/orders.module';
import { UsersModule } from '../src/users/users.module';
import { CartService } from '../src/cart/cart.service';
import { OrdersService } from '../src/orders/orders.service';
import { UsersService } from '../src/users/users.service';

// Regression coverage for the CodeRabbit finding on PR #5: CartService and
// OrdersService used to each get their own PrismaService (and therefore
// their own better-sqlite3 connection) from their own module's `providers`
// array, so a checkout's $transaction and a concurrent cart mutation could
// genuinely race against each other at the database level. PrismaService is
// now provided once by a @Global() PrismaModule, so every feature module
// resolves the exact same instance/connection, and Prisma serializes
// competing operations on it instead of letting them interleave.
describe('Shared PrismaService connection across feature modules (e2e)', () => {
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let prisma: PrismaService;
  let cartService: CartService;
  let ordersService: OrdersService;
  let usersService: UsersService;
  const seededUserIds: string[] = [];

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    cartService = moduleFixture.select(CartModule).get(CartService);
    ordersService = moduleFixture.select(OrdersModule).get(OrdersService);
    usersService = moduleFixture.select(UsersModule).get(UsersService);
  });

  afterAll(async () => {
    if (seededUserIds.length > 0) {
      // Children first: OrderItem/Order (by buyer), CartItem/Cart (by
      // buyer), Product (by seller) - only then the Users themselves.
      await prisma.client.orderItem.deleteMany({
        where: { order: { userId: { in: seededUserIds } } },
      });
      await prisma.client.order.deleteMany({
        where: { userId: { in: seededUserIds } },
      });
      await prisma.client.cartItem.deleteMany({
        where: { cart: { userId: { in: seededUserIds } } },
      });
      await prisma.client.cart.deleteMany({
        where: { userId: { in: seededUserIds } },
      });
      await prisma.client.product.deleteMany({
        where: { sellerId: { in: seededUserIds } },
      });
      await prisma.client.user.deleteMany({
        where: { id: { in: seededUserIds } },
      });
    }
    await app.close();
  });

  it('CartModule and OrdersModule resolve the exact same PrismaService (and PrismaClient)', () => {
    const cartPrisma = moduleFixture
      .select(CartModule)
      .get(PrismaService, { strict: false });
    const ordersPrisma = moduleFixture
      .select(OrdersModule)
      .get(PrismaService, { strict: false });

    expect(cartPrisma).toBe(prisma);
    expect(ordersPrisma).toBe(prisma);
    expect(cartPrisma.client).toBe(ordersPrisma.client);
  });

  it('never silently loses a concurrently-added cart item to an in-flight checkout, across many trials', async () => {
    const trials = 15;

    for (let i = 0; i < trials; i++) {
      const suffix = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
      const buyer = await prisma.client.user.create({
        data: {
          email: `buyer-${suffix}@test.local`,
          password: 'x',
          name: 'Buyer',
        },
      });
      const seller = await prisma.client.user.create({
        data: {
          email: `seller-${suffix}@test.local`,
          password: 'x',
          name: 'Seller',
        },
      });
      seededUserIds.push(buyer.id, seller.id);

      const productA = await prisma.client.product.create({
        data: {
          title: `A-${suffix}`,
          description: 'd',
          category: 'c',
          size: 'M',
          condition: 'Good',
          price: 10,
          sellerId: seller.id,
          isApproved: true,
        },
      });
      const productB = await prisma.client.product.create({
        data: {
          title: `B-${suffix}`,
          description: 'd',
          category: 'c',
          size: 'M',
          condition: 'Good',
          price: 20,
          sellerId: seller.id,
          isApproved: true,
        },
      });

      // Seed the cart with product A so checkout has something to work with.
      await cartService.addItem(buyer.id, productA.id, 1);

      // Race: fire checkout and a concurrent add-to-cart for product B together.
      // A real shipping address is required — createOrder rejects a missing
      // one before ever reaching the $transaction below, which would silently
      // skip the race assertion on every trial instead of exercising it.
      const [orderResult, addResult] = await Promise.allSettled([
        ordersService.createOrder(buyer.id, {
          shippingAddress: {
            street: 'Calle 72 #10-34',
            city: 'Bogotá',
            state: 'Cundinamarca',
            zip: '110221',
            country: 'Colombia',
          },
        }),
        cartService.addItem(buyer.id, productB.id, 1),
      ]);

      // Either operation can legitimately fail for other reasons in this
      // loop, but never with an unhandled DB-level error like SQLITE_BUSY or
      // a unique-constraint violation - check every rejection, not just
      // createOrder's, and regardless of whether the other one also failed.
      for (const result of [orderResult, addResult]) {
        if (result.status === 'rejected') {
          const reason = String(
            (result.reason as Error)?.message ?? result.reason,
          );
          expect(reason).not.toMatch(/SQLITE_BUSY|UNIQUE constraint/i);
        }
      }

      if (
        orderResult.status === 'fulfilled' &&
        addResult.status === 'fulfilled'
      ) {
        const order = orderResult.value;
        const cartAfter = await cartService.getCart(buyer.id);
        const productBInOrder = order.items.some(
          (it) => it.productId === productB.id,
        );
        const productBInCart = cartAfter.items.some(
          (it) => it.productId === productB.id,
        );
        // Product B must land EITHER in the order (added before checkout's
        // read) OR survive in a fresh cart (added after checkout's clear) -
        // it must never silently disappear from both.
        expect(productBInOrder || productBInCart).toBe(true);
      }

      // Clean up this trial's cart items before the next iteration reuses
      // the same shared cart table (each trial uses fresh users, so this is
      // just hygiene, not required for correctness).
      await cartService.clearCart(buyer.id);
    }
  });

  // Regression: UsersService.remove() reads the admin count and deletes the
  // target as two separate operations. Outside of a transaction, two
  // concurrent deletes targeting two different admins — with exactly two
  // admins left — could each read adminCount === 2 before either writes,
  // both pass the "don't delete the last admin" guard, and both proceed:
  // zero admins left. Wrapping both steps in one $transaction closes that
  // window, since the shared connection serializes the two transactions.
  it('never lets two concurrent deletes remove both of the last two administrators', async () => {
    // The guard counts every ADMIN row in the database, so the race is only
    // exercised if exactly two exist at the moment of the race. Temporarily
    // demote any other admins already in this (possibly shared, seeded) dev
    // database, and restore them in `finally` regardless of the outcome.
    const otherAdmins = await prisma.client.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });
    const otherAdminIds = otherAdmins.map((a) => a.id);
    if (otherAdminIds.length > 0) {
      await prisma.client.user.updateMany({
        where: { id: { in: otherAdminIds } },
        data: { role: 'USER' },
      });
    }

    try {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const admin1 = await prisma.client.user.create({
        data: {
          email: `admin1-${suffix}@test.local`,
          password: 'x',
          name: 'Admin 1',
          role: 'ADMIN',
        },
      });
      const admin2 = await prisma.client.user.create({
        data: {
          email: `admin2-${suffix}@test.local`,
          password: 'x',
          name: 'Admin 2',
          role: 'ADMIN',
        },
      });
      const requester = await prisma.client.user.create({
        data: {
          email: `requester-${suffix}@test.local`,
          password: 'x',
          name: 'Requester',
        },
      });
      seededUserIds.push(admin1.id, admin2.id, requester.id);

      const results = await Promise.allSettled([
        usersService.remove(admin1.id, requester.id),
        usersService.remove(admin2.id, requester.id),
      ]);

      const fulfilledCount = results.filter(
        (r) => r.status === 'fulfilled',
      ).length;
      // Exactly one delete must win. Both succeeding would leave zero
      // admins; both being refused is impossible while two remain.
      expect(fulfilledCount).toBe(1);

      const remainingAdminCount = await prisma.client.user.count({
        where: { role: 'ADMIN', id: { in: [admin1.id, admin2.id] } },
      });
      expect(remainingAdminCount).toBe(1);
    } finally {
      if (otherAdminIds.length > 0) {
        await prisma.client.user.updateMany({
          where: { id: { in: otherAdminIds } },
          data: { role: 'ADMIN' },
        });
      }
    }
  });
});
