"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Input,
  Select,
  PageContainer,
  SectionHeader,
  Price,
} from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_REASSURANCE,
  ORDER_STATUS_VARIANT,
} from "@/lib/order-status";
import type { Order, OrderStatus, PaginatedResponse } from "@/lib/types";

type StatusFilter = OrderStatus | "all";

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const { searchInput, setSearchInput, search } = useDebouncedSearch(() =>
    setPage(1),
  );

  const { data, isLoading, isLoadingError, isFetching, isRefetchError, refetch } =
    useQuery<PaginatedResponse<Order>>({
      queryKey: ["orders", search, status, page],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (status !== "all") params.set("status", status);
        params.set("page", String(page));
        params.set("limit", "10");
        const response = await api.get<PaginatedResponse<Order>>(
          `/orders?${params.toString()}`,
        );
        return response.data;
      },
      enabled: Boolean(user),
      // Cada combinación de búsqueda/estado/página es una queryKey nueva: sin
      // esto la lista se vaciaría (y el buscador perdería el foco) en cada
      // pulsación o cambio de filtro.
      placeholderData: keepPreviousData,
    });

  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver tus pedidos."
          action={
            <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando pedidos…
        </div>
      </PageContainer>
    );
  }

  if (isLoadingError) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="No pudimos cargar tus pedidos"
          description="Ocurrió un error al conectar con el servidor. Intenta de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </PageContainer>
    );
  }

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const isFiltered = Boolean(search) || status !== "all";
  // Distinto del vacío real: un buyer sin pedidos nunca ha usado el
  // marketplace, mientras que "sin resultados" es un filtro demasiado
  // angosto — cada uno necesita su propia acción de recuperación.
  const emptyTitle = isFiltered
    ? "Ningún pedido coincide con tu búsqueda"
    : "Aún no tienes pedidos";

  return (
    <PageContainer size="default">
      {isRefetchError && (
        <p
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger"
        >
          <span>No pudimos actualizar tus pedidos.</span>
          <Button variant="ghost" onClick={() => refetch()}>
            Reintentar
          </Button>
        </p>
      )}

      <SectionHeader
        title="Historial de pedidos"
        description="Consulta y sigue tus compras pasadas."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por producto o ID de pedido"
          aria-label="Buscar pedidos"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          className="max-w-md"
          wrapperClassName="flex-1"
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as StatusFilter);
            setPage(1);
          }}
          aria-label="Filtrar por estado"
          className="w-auto"
        >
          <option value="all">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        {isFetching && !isLoading && (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs text-text-muted">
            <Spinner className="h-3.5 w-3.5" /> Actualizando…
          </span>
        )}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={
            isFiltered
              ? undefined
              : "Cuando hagas un pedido, aparecerá aquí."
          }
          action={
            isFiltered ? undefined : (
              <Button onClick={() => router.push("/products")}>
                Explorar productos
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {orders.map((order) => {
            const firstItem = order.items[0];
            const extraItems = order.items.length - 1;
            return (
              <a
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <Card className="hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                      {firstItem?.product?.images?.[0] ? (
                        <Image
                          src={firstItem.product.images[0].url}
                          alt={firstItem.product.title}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm text-text-muted">
                          Pedido #{order.id.slice(0, 8)}
                        </span>
                        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                          {ORDER_STATUS_LABEL[order.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm font-medium text-text-primary">
                        {firstItem?.product?.title ?? "Producto"}
                        {extraItems > 0 &&
                          ` y ${extraItems} producto${extraItems === 1 ? "" : "s"} más`}
                      </p>
                      <p className="mt-1 text-sm text-text-primary">
                        <Price value={order.totalAmount} />
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Realizado el{" "}
                        {new Date(order.createdAt).toLocaleDateString("es-CO")}
                      </p>
                      <p className="mt-1 text-xs font-medium text-text-primary">
                        {ORDER_STATUS_REASSURANCE[order.status]}
                      </p>
                      {order.trackingNumber && (
                        <p className="mt-1 text-xs text-text-muted">
                          Guía: {order.trackingNumber}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </a>
            );
          })}
        </div>
      )}

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </PageContainer>
  );
}
