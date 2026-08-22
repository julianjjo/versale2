import type { ReportCategory } from "./report-category";

// Item 4: every product photo carries its own alternative text. The API only
// accepts bucket URLs (R2) and requires a non-empty alt, so consumers can
// always read `.url` / `.alt` without guarding.
export interface ProductImage {
  url: string;
  alt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  isVerified?: boolean;
}

export interface Product {
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
  rejectedAt?: string | null;
  // Stock lifecycle of a one-of-a-kind garment: SOLD means it was bought and
  // is gone from the catalog; WITHDRAWN is the seller's definitive takedown
  // (reserved — nothing writes it yet); AVAILABLE is buyable. Mirrors the
  // ProductStatus Prisma enum.
  status: "AVAILABLE" | "SOLD" | "WITHDRAWN";
  // Seller-controlled, independent of status/isApproved: temporarily hides an
  // otherwise-live listing from the catalog without deleting it.
  pausedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[] | null;
  // Seller-curated free text (item 4). Optional: a listing without them is
  // valid, the detail page just hides the sections.
  measurements?: string | null;
  defects?: string | null;
  seller?: { id: string; name: string };
  // Detail-page views from anyone other than this listing's own seller (see
  // ProductsService#findOne). A plain scalar column, so it's present
  // anywhere the API embeds the full product (cart items, order items,
  // catalog, detail, /products/mine) — optional here only because
  // FavoritesService's narrower FAVORITE_PRODUCT_SELECT doesn't list it.
  viewCount?: number;
  // favoritedBy/questions are only populated on the seller's own listings
  // (GET /products/mine) alongside viewCount, as the per-listing
  // performance stats mis-productos renders.
  _count?: { reviews: number; favoritedBy?: number; questions?: number };
  reviews?: Review[];
  questions?: ProductQuestion[];
  // Populated by the public catalog listing (GET /products) and the
  // favorites list (GET /favorites) — null means no reviews yet, undefined
  // means this response never computes it (e.g. a seller's own listings or
  // the admin queue).
  averageRating?: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  priceAtAdd: number;
  product?: Product;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: Product;
}

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "DISPUTED"
  | "REFUNDED";

// Item 12: evidencia de la disputa, misma forma que las imágenes de
// producto ({ url, alt }).
export interface OrderDisputePhoto {
  url: string;
  alt: string;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  shippingAddress: Record<string, unknown>;
  trackingNumber?: string | null;
  // Item 12: plazos de la mecánica de disputas/reembolsos.
  paidAt?: string | null;
  deliveredAt?: string | null;
  disputedAt?: string | null;
  disputeExpiresAt?: string | null;
  disputeResolvedAt?: string | null;
  disputeReason?: string | null;
  disputePhotos?: OrderDisputePhoto[] | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  user?: { id: string; name: string; email: string };
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  sellerReply?: string | null;
  sellerRepliedAt?: string | null;
  verifiedPurchase?: boolean;
  // Only populated by GET /products/:id (the page that renders the "¿Te
  // fue útil?" button) — the admin review queue and the legacy
  // /reviews/product/:id list have no reader for either field.
  helpfulCount?: number;
  votedByMe?: boolean;
  user?: { id: string; name: string };
  product?: { id: string; title: string };
}

export interface ProductQuestion {
  id: string;
  productId: string;
  askerId: string;
  question: string;
  answer: string | null;
  answeredAt: string | null;
  createdAt: string;
  asker?: { id: string; name: string };
  // Only populated by the admin listing (GET /questions/admin/all) — the
  // embedded copy on GET /products/:id has no need for it, since the buyer
  // is already looking at that exact product's page.
  product?: { id: string; title: string };
}

export type ReportStatus = "OPEN" | "DISMISSED";

export interface ProductReport {
  id: string;
  productId: string;
  reporterId: string;
  reason: string;
  category: ReportCategory;
  status: ReportStatus;
  // Who/when reviewed it is surfaced entirely through `reviewer` below — the
  // raw id isn't read anywhere, so it isn't modeled here even though the API
  // response also includes it.
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: { id: string; name: string };
  reviewer?: { id: string; name: string } | null;
  product?: { id: string; title: string };
}

export interface Favorite {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product?: Product;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export type NotificationType =
  | "ORDER_SHIPPED"
  | "ORDER_CANCELLED"
  | "ORDER_STATUS_CHANGED";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  orderId: string | null;
  read: boolean;
  createdAt: string;
}
