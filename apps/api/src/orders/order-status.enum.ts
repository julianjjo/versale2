export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
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
};
