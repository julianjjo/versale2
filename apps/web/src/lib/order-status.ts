import type { BadgeVariant } from "@/components/ui";
import type { OrderStatus } from "./types";

export const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export const ORDER_STATUS_REASSURANCE: Record<OrderStatus, string> = {
  PENDING: "Estamos confirmando tu pago.",
  PAID: "Tu pedido se está preparando para el envío.",
  SHIPPED: "Tu pedido está en camino.",
  DELIVERED: "Tu pedido fue entregado.",
  CANCELLED: "Este pedido fue cancelado.",
};

export function statusVariantFor(status: OrderStatus): BadgeVariant {
  return ORDER_STATUS_VARIANT[status];
}
