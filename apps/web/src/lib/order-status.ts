import type { BadgeVariant } from "@/components/ui";
import type { OrderStatus } from "./types";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value.trim());
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  DISPUTED: "En disputa",
  REFUNDED: "Reembolsado",
};

export function orderStatusLabel(status: string): string {
  return (ORDER_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["DISPUTED"],
  DISPUTED: ["REFUNDED", "DELIVERED"],
  CANCELLED: [],
  REFUNDED: [],
};

export function nextStatusesFor(status: OrderStatus): OrderStatus[] {
  return ALLOWED_STATUS_TRANSITIONS[status] ?? [];
}

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

