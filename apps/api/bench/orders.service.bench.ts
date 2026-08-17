import { bench, describe } from 'vitest';
import { OrdersService } from '../src/orders/orders.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { NotificationsService } from '../src/notifications/notifications.service';
import { Role } from '../src/users/role.enum';
import { makeCart } from './fixtures';

// createOrder() (the only method benched below) never touches
// NotificationsService, so this only needs to satisfy the constructor.
const notificationsStub = {
  create: () => Promise.resolve(undefined),
  createMany: () => Promise.resolve({ count: 0 }),
} as unknown as NotificationsService;

const buyerId = 'buyer-1';
const smallCart = makeCart(5, buyerId);
const largeCart = makeCart(100, buyerId);

function serviceForCart(cart: ReturnType<typeof makeCart>) {
  const tx = {
    cart: { findUnique: () => Promise.resolve(cart) },
    order: {
      create: ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'order-1', ...data }),
    },
    cartItem: { deleteMany: () => Promise.resolve({ count: 0 }) },
  };

  const prismaStub = {
    client: {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
      order: {
        findMany: () => Promise.resolve([]),
        findUnique: () =>
          Promise.resolve({
            id: 'order-1',
            userId: buyerId,
            status: 'PENDING',
            totalAmount: 120000,
            items: cart.items.map((item) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              price: item.priceAtAdd,
              product: item.product,
            })),
          }),
      },
    },
  } as unknown as PrismaService;

  return new OrdersService(prismaStub, notificationsStub);
}

const smallCartService = serviceForCart(smallCart);
const largeCartService = serviceForCart(largeCart);

describe('OrdersService.createOrder', () => {
  bench('checkout a 5-item cart', async () => {
    await smallCartService.createOrder(buyerId, {
      shippingAddress: { city: 'Bogotá', line1: 'Calle 100 #10-20' },
    });
  });

  bench('checkout a 100-item cart', async () => {
    await largeCartService.createOrder(buyerId, {
      shippingAddress: { city: 'Medellín', line1: 'Carrera 43 #5-10' },
    });
  });
});

describe('OrdersService.getOrderById', () => {
  bench('owner reads their order', async () => {
    await largeCartService.getOrderById('order-1', buyerId, Role.USER);
  });

  bench('admin reads any order', async () => {
    await largeCartService.getOrderById('order-1', 'admin-1', Role.ADMIN);
  });
});
