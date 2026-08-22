export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  DISPUTED = 'DISPUTED',
  REFUNDED = 'REFUNDED',
}

// The enum values stay the English keys, but any message that reaches a user
// has to name the state the way the UI does. Mirrors ORDER_STATUS_LABEL in
// apps/web/src/lib/order-status.ts.
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendiente',
  [OrderStatus.PAID]: 'Pagado',
  [OrderStatus.SHIPPED]: 'Enviado',
  [OrderStatus.DELIVERED]: 'Entregado',
  [OrderStatus.CANCELLED]: 'Cancelado',
  [OrderStatus.DISPUTED]: 'En disputa',
  [OrderStatus.REFUNDED]: 'Reembolsado',
};

// A review only counts as coming from a verified buyer once the sale actually
// went through — not a PENDING (unpaid) or CANCELLED order. Shared by every
// place that has to answer "did this user actually buy this product" (right
// now, ReviewsService and ProductsService both need this exact same rule).
export const VERIFIED_PURCHASE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];
