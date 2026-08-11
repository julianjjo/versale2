"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Select,
  Input,
  Checkbox,
  Button,
  Price,
} from "@/components/ui";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/lib/order-status";
import type { Order, OrderStatus } from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";

const STATUSES = ORDER_STATUSES;

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", search, page],
    queryFn: async () => {
      const res = await api.get<{
        data: Order[];
        meta: { total: number; page: number; pages: number };
      }>(
        `/orders/admin/all?search=${encodeURIComponent(search)}&page=${page}&limit=20`,
      );
      return res.data;
    },
  });

  const invalidateOrders = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      await api.patch(`/orders/admin/${id}/status`, { status });
    },
    onSuccess: invalidateOrders,
    onError: (err) =>
      setError(extractApiError(err, "No pudimos cambiar el estado")),
  });

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({
      ids,
      status,
    }: {
      ids: string[];
      status: OrderStatus;
    }) => {
      await Promise.all(
        ids.map((id) => api.patch(`/orders/admin/${id}/status`, { status })),
      );
    },
    onSuccess: () => {
      invalidateOrders();
      setSelected(new Set());
      setBulkStatus("");
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos actualizar los pedidos seleccionados")),
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const allInViewSelected =
    orders.length > 0 && orders.every((o) => selected.has(o.id));

  const toggleOrder = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInView = () => {
    setSelected((prev) => {
      if (allInViewSelected) {
        const next = new Set(prev);
        orders.forEach((o) => next.delete(o.id));
        return next;
      }
      const next = new Set(prev);
      orders.forEach((o) => next.add(o.id));
      return next;
    });
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Cargando…
      </div>
    );
  }

  return (
    <div className="pb-20">
      <h2 className="heading-section mb-4 text-text-primary">
        Todos los pedidos
      </h2>

      <div className="mb-4">
        <Input
          type="search"
          placeholder="Buscar por comprador, correo o ID de pedido"
          aria-label="Buscar pedidos"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-md"
        />
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title={search ? "Ningún pedido coincide con la búsqueda" : "Aún no hay pedidos"}
        />
      ) : (
        <>
          <div className="mb-2 flex items-center gap-2 px-1">
            <Checkbox
              checked={allInViewSelected}
              onChange={toggleAllInView}
              aria-label="Seleccionar todos los pedidos visibles"
            />
            <span className="text-xs text-text-muted">
              Seleccionar todo lo visible
            </span>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(order.id)}
                    onChange={() => toggleOrder(order.id)}
                    aria-label={`Seleccionar pedido ${order.id.slice(0, 8)}`}
                    className="mt-1"
                  />
                  <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-mono font-medium text-text-primary hover:underline"
                      >
                        Pedido #{order.id.slice(0, 8)}
                      </Link>
                      <p className="mt-1 text-xs text-text-muted">
                        Comprador: {order.user?.name ?? "—"}
                        {order.user?.email ? ` · ${order.user.email}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {order.items.length} producto
                        {order.items.length === 1 ? "" : "s"} ·{" "}
                        <Price value={order.totalAmount} /> ·{" "}
                        {new Date(order.createdAt).toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:flex-shrink-0">
                      <Select
                        value={order.status}
                        onChange={(e) =>
                          updateStatus.mutate({
                            id: order.id,
                            status: e.target.value as OrderStatus,
                          })
                        }
                        disabled={updateStatus.isPending}
                        aria-label="Estado del pedido"
                        className="flex-1 text-sm sm:w-40 sm:flex-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                      <Badge
                        variant={ORDER_STATUS_VARIANT[order.status]}
                        className="flex-shrink-0"
                      >
                        {ORDER_STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {meta && meta.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            disabled={meta.page <= 1}
            onClick={() => {
              setPage((p) => p - 1);
              setSelected(new Set());
            }}
          >
            ‹ Anterior
          </Button>
          <span className="text-sm text-text-muted">
            Página {meta.page} de {meta.pages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.pages}
            onClick={() => {
              setPage((p) => p + 1);
              setSelected(new Set());
            }}
          >
            Siguiente ›
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
          <div className="flex w-full max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[0_20px_50px_-20px_rgba(26,26,26,0.35)]">
            <span className="text-sm font-medium text-text-primary">
              {selected.size === 1
                ? "1 pedido seleccionado"
                : `${selected.size} pedidos seleccionados`}
            </span>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              aria-label="Nuevo estado para los pedidos seleccionados"
              className="w-44 text-sm"
              disabled={bulkUpdateStatus.isPending}
            >
              <option value="">Elegir estado…</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!bulkStatus || bulkUpdateStatus.isPending}
              onClick={() =>
                bulkStatus &&
                bulkUpdateStatus.mutate({
                  ids: Array.from(selected),
                  status: bulkStatus,
                })
              }
            >
              {bulkUpdateStatus.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                "Aplicar"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              disabled={bulkUpdateStatus.isPending}
            >
              Cancelar selección
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
