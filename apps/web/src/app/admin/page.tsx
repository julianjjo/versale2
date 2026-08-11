"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Spinner, Card, Price } from "@/components/ui";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/lib/order-status";
import { Badge } from "@/components/ui";
import type { Order, Product, User } from "@/lib/types";

export default function AdminOverview() {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products-pending"],
    queryFn: async () => {
      const res = await api.get<{
        data: Product[];
        meta: { total: number };
      }>("/products/admin/all?isApproved=false&limit=1");
      return res.data;
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await api.get<Order[]>("/orders/admin/all");
      return res.data;
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get<User[]>("/users");
      return res.data;
    },
  });

  const pendingProducts = products?.meta.total ?? 0;
  const totalOrders = orders?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const totalRevenue = orders
    ?.filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.totalAmount, 0) ?? 0;

  const loading = productsLoading || ordersLoading || usersLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Cargando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Productos pendientes"
          value={pendingProducts}
          href="/admin/products"
        />
        <StatCard
          label="Pedidos totales"
          value={totalOrders}
          href="/admin/orders"
        />
        <StatCard
          label="Usuarios totales"
          value={totalUsers}
          href="/admin/users"
        />
        <StatCard
          label="Ingresos (COP)"
          value={formatRevenue(totalRevenue)}
        />
      </div>

      {orders && orders.length > 0 && (
        <Card>
          <h2 className="heading-card mb-3">Pedidos recientes</h2>
          <div className="divide-y divide-border">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="font-mono text-text-muted">
                  #{order.id.slice(0, 8)}
                </span>
                <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                  {ORDER_STATUS_LABEL[order.status]}
                </Badge>
                <Price
                  value={order.totalAmount}
                  className="font-semibold"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function formatRevenue(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-shadow hover:shadow-md">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">
        {value}
      </p>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
