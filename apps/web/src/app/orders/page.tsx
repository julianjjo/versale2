"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  PageContainer,
  SectionHeader,
  Price,
} from "@/components/ui";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_REASSURANCE,
  ORDER_STATUS_VARIANT,
} from "@/lib/order-status";
import type { Order } from "@/lib/types";

export default function OrdersPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading, isLoadingError, isRefetchError, refetch } = useQuery<
    Order[]
  >({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await api.get<Order[]>("/orders");
      return response.data;
    },
    enabled: Boolean(user),
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
      {data && data.length === 0 ? (
        <EmptyState
          title="Aún no tienes pedidos"
          description="Cuando hagas un pedido, aparecerá aquí."
          action={
            <Button onClick={() => router.push("/products")}>
              Explorar productos
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data?.map((order) => (
            <a
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <Card className="hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-text-muted">
                    Pedido #{order.id.slice(0, 8)}
                  </span>
                  <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-text-primary">
                  {order.items.length} producto
                  {order.items.length === 1 ? "" : "s"} ·{" "}
                  <Price value={order.totalAmount} />
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Realizado el{" "}
                  {new Date(order.createdAt).toLocaleDateString("es-CO")}
                </p>
                <p className="mt-1 text-xs font-medium text-text-primary">
                  {ORDER_STATUS_REASSURANCE[order.status]}
                </p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
