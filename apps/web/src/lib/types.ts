import type { ReportCategory } from "./report-category";

export interface ProductImage {
  url: string;
  alt: string;
}

export const USER_ROLES = ["USER", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value.trim());
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isVerified?: boolean;
}

export const PRODUCT_STATUSES = ["AVAILABLE", "SOLD", "WITHDRAWN"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value.trim());
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  AVAILABLE: "Disponible",
  SOLD: "Vendido",
  WITHDRAWN: "Retirado",
};

export function productStatusLabel(status: string): string {
  const trimmed = status.trim();
  const key =
    PRODUCT_STATUSES.find((s) => s.toLowerCase() === trimmed.toLowerCase()) ??
    trimmed;
  return (PRODUCT_STATUS_LABEL as Record<string, string>)[key] ?? status;
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
  status: ProductStatus;
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

export const REPORT_STATUSES = ["OPEN", "DISMISSED"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export function isReportStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value.trim());
}

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

export const NOTIFICATION_TYPES = [
  "ORDER_SHIPPED",
  "ORDER_CANCELLED",
  "ORDER_STATUS_CHANGED",
  "QUESTION_ASKED",
  "QUESTION_ANSWERED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value.trim());
}

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  ORDER_SHIPPED: "Pedido enviado",
  ORDER_CANCELLED: "Pedido cancelado",
  ORDER_STATUS_CHANGED: "Estado actualizado",
  QUESTION_ASKED: "Pregunta recibida",
  QUESTION_ANSWERED: "Respuesta recibida",
};

export function notificationTypeLabel(type: string): string {
  const trimmed = type.trim();
  const key =
    NOTIFICATION_TYPES.find((t) => t.toLowerCase() === trimmed.toLowerCase()) ??
    trimmed;
  return (NOTIFICATION_TYPE_LABEL as Record<string, string>)[key] ?? type;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  orderId: string | null;
  read: boolean;
  createdAt: string;
}
