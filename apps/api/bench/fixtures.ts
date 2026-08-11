/**
 * Shared fixtures for the API benchmarks.
 *
 * The services are exercised against in-memory Prisma stubs: the point is to
 * measure the service-level logic (validation, authorization, totals, query
 * building, response shaping) without the noise of a real database.
 */

const BASE_DATE = new Date('2024-01-01T00:00:00.000Z');

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const BRANDS = ["Levi's", 'Zara', 'Nike', null];

export interface BenchProduct {
  id: string;
  title: string;
  description: string;
  category: string;
  brand: string | null;
  size: string;
  condition: string;
  price: number;
  sellerId: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: string[] | null;
  seller: { id: string; name: string };
  _count: { reviews: number };
}

export function makeProduct(index: number): BenchProduct {
  return {
    id: `p${index}`,
    title: `Chaqueta vintage de mezclilla #${index}`,
    description:
      'Clásica chaqueta trucker en muy buen estado, poco uso y sin manchas.',
    category: 'Jackets',
    brand: BRANDS[index % BRANDS.length],
    size: SIZES[index % SIZES.length],
    condition: CONDITIONS[index % CONDITIONS.length],
    price: 25000 + index * 1500,
    sellerId: `s${index % 7}`,
    isApproved: true,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    images: index % 5 === 0 ? null : [`https://example.com/p${index}.jpg`],
    seller: { id: `s${index % 7}`, name: `Vendedor ${index % 7}` },
    _count: { reviews: index % 13 },
  };
}

export function makeProducts(count: number): BenchProduct[] {
  return Array.from({ length: count }, (_, i) => makeProduct(i));
}

export interface BenchCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  priceAtAdd: number;
  product: BenchProduct;
}

export function makeCart(itemCount: number, buyerId = 'buyer-1') {
  const items: BenchCartItem[] = Array.from(
    { length: itemCount },
    (_, index) => {
      const product = makeProduct(index);
      // Buyers can't purchase their own products, so make sure no seller
      // collides with the buyer id.
      product.sellerId = `seller-${index % 7}`;
      return {
        id: `ci${index}`,
        cartId: 'cart-1',
        productId: product.id,
        quantity: (index % 3) + 1,
        priceAtAdd: product.price,
        product,
      };
    },
  );

  return { id: 'cart-1', userId: buyerId, items };
}
