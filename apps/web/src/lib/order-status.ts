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
  PENDING: "Pending",
  PAID: "Paid",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export function statusVariantFor(status: OrderStatus): BadgeVariant {
  return ORDER_STATUS_VARIANT[status];
}
