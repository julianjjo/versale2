"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, extractApiError, extractBlobApiError } from "@/lib/api";
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
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
  commonNextStatuses,
  nextStatusesFor,
} from "@/lib/order-status";
import { Pager } from "@/components/admin/pager";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import type { Order, OrderStatus } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// CANCELLED/REFUNDED are terminal (nextStatusesFor returns []) same as
// DELIVERED, but unlike DELIVERED they undo a sale that already happened —
// relisting the garment and notifying buyer/seller — instead of completing
// one. Every other destructive admin action (reject, delete, dismiss) already
// asks for confirmation; this is the one status change that didn't.
function isIrreversibleOrderStatus(status: OrderStatus): boolean {
  return status === "CANCELLED" || status === "REFUNDED";
}

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [isExporting, setIsExporting] = useState(false);
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const [bulkBarHeight, setBulkBarHeight] = useState(0);

  const { searchInput, setSearchInput, search } = useDebouncedSearch(() => {
    setPage(1);
    // Un término nuevo muestra otra lista: lo que estaba marcado ya no está a
    // la vista, así que la selección se descarta.
    setSelected(new Set());
  });

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

  // Not a useMutation: the result is a file the browser has to save, not
  // cache-invalidating state React Query needs to track.
  const handleExportCsv = async () => {
    setError(null);
    setIsExporting(true);
    try {
      const res = await api.get<Blob>(
        `/orders/admin/export?search=${encodeURIComponent(search)}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pedidos.csv";
      link.click();
      // Revoking synchronously right after click() races Safari's download
      // kickoff (which isn't guaranteed synchronous) and can truncate the
      // file — yielding a tick first is the standard fix; Chrome/Firefox are
      // unaffected either way.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      setError(await extractBlobApiError(err, "No pudimos generar el archivo CSV"));
    } finally {
      setIsExporting(false);
    }
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      await api.patch(`/orders/admin/${id}/status`, { status });
    },
    // Sin esto un rechazo anterior se quedaba en pantalla incluso despues de un
    // cambio exitoso: el banner solo se escribia, nunca se limpiaba.
    onMutate: () => setError(null),
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

  // La selección siempre vive dentro de la página visible (cambiar de página la
  // limpia), así que podemos resolver el estado de cada pedido seleccionado. Solo
  // ofrecemos los estados legales para *todos* ellos: aplicar uno que solo vale
  // para algunos fallaba por construcción, y el resumen "Actualizamos N de M"
  // invitaba a reintentar algo que nunca podía funcionar.
  const selectedOrders = orders.filter((o) => selected.has(o.id));
  const bulkOptions = commonNextStatuses(selectedOrders.map((o) => o.status));
  const bulkStatusIsApplicable =
    bulkStatus !== "" && bulkOptions.includes(bulkStatus);

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
        <Button
          variant="secondary"
          size="sm"
          className="flex-shrink-0"
          onClick={handleExportCsv}
          disabled={isExporting}
        >
          {isExporting ? "Generando…" : "Descargar CSV"}
        </Button>
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
                        onChange={(e) => {
                          const status = e.target.value as OrderStatus;
                          if (
                            isIrreversibleOrderStatus(status) &&
                            !confirm(
                              `¿Cambiar el pedido #${order.id.slice(0, 8)} a "${ORDER_STATUS_LABEL[status]}"? Esta acción no se puede deshacer.`,
                            )
                          ) {
                            return;
                          }
                          updateStatus.mutate({ id: order.id, status });
                        }}
                        disabled={
                          updateStatus.isPending ||
                          nextStatusesFor(order.status).length === 0
                        }
                        aria-label="Estado del pedido"
                        className="flex-1 text-sm sm:w-40 sm:flex-none"
                      >
                        {/* Solo los estados a los que este pedido puede pasar. El
                            estado actual va como opción deshabilitada porque un
                            <select> necesita su propio valor para mostrarlo. En un
                            estado terminal (Entregado, Cancelado) no queda ninguna
                            transición legal y el control se deshabilita, en vez de
                            ofrecer opciones que la API siempre rechaza. */}
                        <option value={order.status} disabled>
                          {ORDER_STATUS_LABEL[order.status]}
                        </option>
                        {nextStatusesFor(order.status).map((s) => (
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

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={(next) => {
          setPage(next);
          // Otra página, otras filas: lo marcado deja de estar a la vista.
          setSelected(new Set());
        }}
      />

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
              disabled={bulkUpdateStatus.isPending || bulkOptions.length === 0}
            >
              <option value="">
                {bulkOptions.length === 0
                  ? "Sin cambios posibles"
                  : "Elegir estado…"}
              </option>
              {bulkOptions.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!bulkStatusIsApplicable || bulkUpdateStatus.isPending}
              onClick={() => {
                if (!bulkStatusIsApplicable) return;
                const status = bulkStatus as OrderStatus;
                if (
                  isIrreversibleOrderStatus(status) &&
                  !confirm(
                    `¿Cambiar ${
                      selected.size === 1
                        ? "el pedido seleccionado"
                        : `los ${selected.size} pedidos seleccionados`
                    } a "${ORDER_STATUS_LABEL[status]}"? Esta acción no se puede deshacer.`,
                  )
                ) {
                  return;
                }
                bulkUpdateStatus.mutate({ ids: Array.from(selected), status });
              }}
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
