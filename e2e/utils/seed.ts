import { PrismaClient, Role } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import * as bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:./apps/api/e2e.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

export const E2E_USERS = {
  user: {
    email: "user@e2e.test",
    password: "user12345",
    name: "E2E User",
  },
  admin: {
    email: "admin@e2e.test",
    password: "admin12345",
    name: "E2E Admin",
  },
  author: {
    email: "author@e2e.test",
    password: "author12345",
    name: "E2E Author",
  },
};

export const E2E_PRODUCTS = [
  {
    title: "Vintage Denim Jacket",
    description: "Classic Levi's trucker jacket, gently worn",
    category: "Jackets",
    brand: "Levi's",
    size: "M",
    condition: "Good",
    price: 45.0,
    isApproved: true,
  },
  {
    title: "Wool Sweater",
    description: "Cozy merino wool sweater for cold days",
    category: "Sweaters",
    brand: null,
    size: "L",
    condition: "Like New",
    price: 30.0,
    isApproved: true,
  },
  {
    title: "Cotton T-Shirt",
    description: "Soft basic white tee",
    category: "Tops",
    brand: null,
    size: "S",
    condition: "Good",
    price: 12.0,
    isApproved: false,
  },
];

export async function seedDatabase() {
  await prisma.review.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  const userHash = await bcrypt.hash(E2E_USERS.user.password, 4);
  const adminHash = await bcrypt.hash(E2E_USERS.admin.password, 4);
  const authorHash = await bcrypt.hash(E2E_USERS.author.password, 4);

  const user = await prisma.user.create({
    data: {
      email: E2E_USERS.user.email,
      password: userHash,
      name: E2E_USERS.user.name,
      role: Role.USER,
    },
  });

  await prisma.user.create({
    data: {
      email: E2E_USERS.admin.email,
      password: adminHash,
      name: E2E_USERS.admin.name,
      role: Role.ADMIN,
    },
  });

  const author = await prisma.user.create({
    data: {
      email: E2E_USERS.author.email,
      password: authorHash,
      name: E2E_USERS.author.name,
      role: Role.USER,
    },
  });

  for (const product of E2E_PRODUCTS) {
    await prisma.product.create({
      data: {
        ...product,
        sellerId: author.id,
      },
    });
  }

  // Reseñas solo tras entrega (1.6): the seeded user needs a DELIVERED order
  // over a seeded listing or the review e2e flows 400 at the new eligibility
  // check. Admin/order tests create their own buyers and locate rows by id,
  // so this seeded order doesn't collide with them.
  const jacket = await prisma.product.findFirst({
    where: { title: "Vintage Denim Jacket" },
  });
  if (jacket) {
    await prisma.order.create({
      data: {
        userId: user.id,
        status: "DELIVERED",
        totalAmount: jacket.price,
        shippingAddress: {
          street: "Calle E2E 123",
          city: "Bogotá",
          state: "Cundinamarca",
          zip: "110111",
          country: "Colombia",
        },
        items: {
          create: { productId: jacket.id, quantity: 1, price: jacket.price },
        },
      },
    });
  }

  return { user, author };
}

if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log("E2E database seeded");
      return prisma.$disconnect();
    })
    .catch((e) => {
      console.error(e);
      return prisma.$disconnect().then(() => process.exit(1));
    });
}
