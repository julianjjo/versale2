import type { BadgeVariant } from "@/components/ui";
import type { OrderStatus } from "./types";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  // Item 12.
  "DISPUTED",
  "REFUNDED",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  DISPUTED: "En disputa",
  REFUNDED: "Reembolsado",
};

// Mirrors ALLOWED_STATUS_TRANSITIONS in apps/api/src/orders/order-status.enum.ts.
// The API is the authority — it rejects anything else with a 400 — but the admin
// UI needs the same table so it can offer only the moves that will be accepted,
// instead of presenting all five statuses and letting the admin discover the
// lifecycle through error banners.
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  // REFUNDED desde PAID es el timeout de 7 días sin envío (cron).
  PAID: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED"],
  // Item 12: la entrega puede entrar en disputa; la resolución del admin
  // reembolsa o rechaza de vuelta a DELIVERED.
  DELIVERED: ["DISPUTED"],
  DISPUTED: ["REFUNDED", "DELIVERED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses an order in `status` can legally move to. Empty for terminal states. */
export function nextStatusesFor(status: OrderStatus): OrderStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[status] ?? [];
}

/** Statuses every one of `statuses` can legally move to — for bulk actions. */
export function commonNextStatuses(statuses: OrderStatus[]): OrderStatus[] {
  if (statuses.length === 0) return [];
  return statuses
    .map(nextStatusesFor)
    .reduce((shared, next) => shared.filter((s) => next.includes(s)));
}

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
  DISPUTED: "warning",
  REFUNDED: "danger",
};

export const ORDER_STATUS_REASSURANCE: Record<OrderStatus, string> = {
  PENDING: "Estamos confirmando tu pago.",
  PAID: "Tu pedido se está preparando para el envío.",
  SHIPPED: "Tu pedido está en camino.",
  DELIVERED: "Tu pedido fue entregado.",
  CANCELLED: "Este pedido fue cancelado.",
  DISPUTED:
    "Tu disputa está en revisión por un administrador. Te avisaremos la resolución.",
  REFUNDED: "El monto de este pedido te fue reembolsado.",
};

export function statusVariantFor(status: OrderStatus): BadgeVariant {
  return ORDER_STATUS_VARIANT[status];
}
