import type { Order, OrderStatus, Product } from "@/lib/types";

const CONDITIONS = ["New", "Like New", "Good", "Fair"];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const BRANDS = ["Levi's", "Zara", "Nike", null];
const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const BASE_DATE = new Date("2024-01-01T00:00:00.000Z").toISOString();

export function makeProduct(index: number): Product {
  return {
    id: `p${index}`,
    title: `Chaqueta vintage de mezclilla #${index}`,
    description:
      "Clásica chaqueta trucker en muy buen estado, poco uso y sin manchas.",
    category: "Jackets",
    brand: BRANDS[index % BRANDS.length],
    size: SIZES[index % SIZES.length],
    condition: CONDITIONS[index % CONDITIONS.length],
    price: 25000 + index * 1500,
    sellerId: `s${index % 7}`,
    isApproved: index % 9 !== 0,
    status: index % 17 === 0 ? ("SOLD" as const) : ("AVAILABLE" as const),
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    images: index % 5 === 0 ? null : [`https://example.com/p${index}.jpg`],
    seller: { id: `s${index % 7}`, name: `Vendedor ${index % 7}` },
    _count: { reviews: index % 13 },
  };
}

export function makeProducts(count: number): Product[] {
  return Array.from({ length: count }, (_, i) => makeProduct(i));
}

export function makeOrder(index: number): Order {
  return {
    id: `o${index}`,
    userId: `u${index % 11}`,
    status: STATUSES[index % STATUSES.length],
    totalAmount: 45000 + index * 900,
    shippingAddress: { city: "Bogotá", line1: `Calle ${index}` },
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    items: [
      { id: `oi${index}-1`, productId: `p${index}`, quantity: 1, price: 25000 },
      {
        id: `oi${index}-2`,
        productId: `p${index + 1}`,
        quantity: 2,
        price: 10000,
      },
    ],
  };
}

export function makeOrders(count: number): Order[] {
  return Array.from({ length: count }, (_, i) => makeOrder(i));
}
