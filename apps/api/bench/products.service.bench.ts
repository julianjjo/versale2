import { bench, describe } from 'vitest';
import { ProductsService } from '../src/products/products.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../src/users/role.enum';
import { makeProduct, makeProducts } from './fixtures';

const page = makeProducts(50);
const catalogSize = 5000;

const detailedProduct = {
  ...makeProduct(1),
  reviews: Array.from({ length: 40 }, (_, i) => ({
    id: `r${i}`,
    rating: (i % 5) + 1,
    comment: 'Muy buen producto, llegó rápido y tal como se describe.',
    createdAt: new Date('2024-02-01T00:00:00.000Z'),
    user: { id: `u${i}`, name: `Usuario ${i}` },
  })),
};

const prismaStub = {
  client: {
    product: {
      findMany: () => Promise.resolve(page),
      count: () => Promise.resolve(catalogSize),
      findUnique: () => Promise.resolve(detailedProduct),
      // findOne()'s view-count increment fires for any requester that
      // isn't the product's own seller — the 'u1' requester below never
      // is, so this needs a stub too or the bench crashes on its first
      // iteration.
      update: () => Promise.resolve(detailedProduct),
    },
    // findAll() also fetches each page's average rating via a review
    // groupBy — an empty result (no reviews) keeps this bench measuring
    // findAll's own cost instead of throwing on every iteration.
    review: {
      groupBy: () => Promise.resolve([]),
    },
  },
} as unknown as PrismaService;

const service = new ProductsService(prismaStub);

describe('ProductsService.findAll', () => {
  bench('no filters, first page', async () => {
    await service.findAll({});
  });

  bench('search + price range + facets', async () => {
    await service.findAll({
      search: 'chaqueta',
      minPrice: 20000,
      maxPrice: 90000,
      size: 'M',
      brand: 'Levi',
      condition: 'Good',
      page: 4,
      limit: 50,
    });
  });

  bench('admin listing, deep page', async () => {
    await service.findAllForAdmin({ page: 42, limit: 50 });
  });
});

describe('ProductsService.findOne', () => {
  bench('approved product with 40 reviews', async () => {
    await service.findOne('p1', { id: 'u1', role: Role.USER });
  });

  bench('raw lookup', async () => {
    await service.findRaw('p1');
  });
});
