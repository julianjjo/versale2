import type { ReportCategory } from "./report-category";

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
  status: "AVAILABLE" | "SOLD" | "WITHDRAWN";
  pausedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  images?: ProductImage[] | null;
  measurements?: string | null;
  defects?: string | null;
  seller?: { id: string; name: string };
  viewCount?: number;
  _count?: { reviews: number; favoritedBy?: number; questions?: number };
  reviews?: Review[];
  questions?: ProductQuestion[];
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
