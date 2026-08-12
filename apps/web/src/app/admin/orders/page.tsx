"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
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
import { useEffect, useRef, useState } from "react";
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
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const [bulkBarHeight, setBulkBarHeight] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      // Si el término no cambió (montaje, espacios al final) no reiniciamos la
      // paginación ni borramos lo que el admin ya tenía seleccionado.
      if (next === search) return;
      setSearch(next);
      setPage(1);
      setSelected(new Set());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const { data, isLoading, isFetching } = useQuery({
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
    // Cada término de búsqueda es una queryKey nueva: sin esto la página se
    // quedaría sin datos y el buscador se desmontaría (perdiendo el foco y el
    // cursor) en cada pulsación.
    placeholderData: keepPreviousData,
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
      // allSettled y no all: una sola falla no debe descartar las escrituras
      // que sí funcionaron ni impedir que refresquemos la lista.
      const results = await Promise.allSettled(
        ids.map((id) => api.patch(`/orders/admin/${id}/status`, { status })),
      );
      const failedIds = ids.filter((_, i) => results[i].status === "rejected");
      return { total: ids.length, failedIds };
    },
    onMutate: () => setError(null),
    onSuccess: ({ total, failedIds }) => {
      const failed = failedIds.length;
      const succeeded = total - failed;
      // Los que fallaron siguen seleccionados (y conservamos el estado elegido)
      // para poder reintentar sin volver a marcarlos uno por uno.
      setSelected(new Set(failedIds));
      if (failed === 0) {
        setBulkStatus("");
        return;
      }
      setError(
        succeeded === 0
          ? `No pudimos actualizar ${
              failed === 1
                ? "el pedido seleccionado"
                : `los ${failed} pedidos seleccionados`
            }. Intenta de nuevo.`
          : `Actualizamos ${succeeded} de ${total} pedidos. ${
              failed === 1
                ? "1 quedó sin actualizar y sigue seleccionado"
                : `${failed} quedaron sin actualizar y siguen seleccionados`
            }.`,
      );
    },
    // Pase lo que pase, la lista se recarga: nunca dejamos estados obsoletos.
    onSettled: invalidateOrders,
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

  // La barra de selección es fija y en móvil se envuelve en dos o tres líneas,
  // así que un padding fijo nunca alcanza. Medimos su alto real (incluido su
  // propio padding) y reservamos exactamente ese espacio bajo la lista.
  useEffect(() => {
    const el = bulkBarRef.current;
    if (!el) {
      setBulkBarHeight(0);
      return;
    }
    const measure = () => setBulkBarHeight(el.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [selected.size, bulkUpdateStatus.isPending]);

  return (
    <div style={{ paddingBottom: bulkBarHeight }}>
      <h2 className="heading-section mb-4 text-text-primary">
        Todos los pedidos
      </h2>

      <div className="mb-4 flex items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por comprador, correo o ID de pedido"
          aria-label="Buscar pedidos"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-md"
          wrapperClassName="flex-1"
        />
        {isFetching && !isLoading && (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs text-text-muted">
            <Spinner className="h-3.5 w-3.5" /> Actualizando…
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title={search ? "Ningún pedido coincide con la búsqueda" : "Aún no hay pedidos"}
        />
      ) : (
        <div aria-busy={isFetching}>
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
        </div>
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
        <div
          ref={bulkBarRef}
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
        >
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
