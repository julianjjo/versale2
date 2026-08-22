"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  PageContainer,
  Price,
  Divider,
  Textarea,
} from "@/components/ui";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_REASSURANCE,
  ORDER_STATUS_VARIANT,
  nextStatusesFor,
} from "@/lib/order-status";
import { conditionLabel } from "@/lib/product-condition";
import { isTerminalError } from "@/lib/http-error";
import { OrderStatusTimeline } from "@/components/orders/order-status-timeline";
import type { Order } from "@/lib/types";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<Order>({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const response = await api.get<Order>(`/orders/${params.id}`);
      return response.data;
    },
    enabled: Boolean(user && params.id),
  });

  const cancelOrder = useMutation({
    // This page only ever cancels the order it's already showing — no need
    // to thread an id through the mutation when `params.id` is right there.
    mutationFn: async () => {
      await api.patch(`/orders/${params.id}/cancel`);
    },
    // Awaited, not fire-and-forget: `isPending` (which the button's
    // `disabled` and spinner key off) flips back to `false` as soon as this
    // resolves. Without awaiting, it flipped the instant the PATCH itself
    // resolved — before `["order", params.id]` had actually refetched — so
    // the button could re-render enabled with the pre-cancel status for one
    // more paint, open to a fast double-click sending a second cancel at an
    // order that's already CANCELLED.
    onSuccess: async () => {
      // Cancelling releases the garments back to the catalog, so every cache
      // that could be showing them (the catalog itself, each product's own
      // page, and the admin dashboards) needs to drop its stale copy too —
      // not just this order and the buyer's own list. `["product"]` and
      // `["products"]` prefix-match every per-item and catalog-filter entry,
      // so no per-item loop is needed here.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["order", params.id] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-orders-recent"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-order-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["product"] }),
      ]);
      setCancelSuccess(true);
    },
    // A conflict (the compare-and-swap in transitionStatus rejecting a status
    // that moved since this page last read it — e.g. an admin just shipped
    // it) means the badge and the still-visible Cancelar button are showing
    // a status that's no longer real. Refetching here is what makes the
    // button correctly disappear on its own instead of inviting a retry
    // that will just fail the same way again.
    onError: (err) => {
      setCancelError(extractApiError(err, "No pudimos cancelar el pedido"));
      queryClient.invalidateQueries({ queryKey: ["order", params.id] });
    },
  });

  // ── Item 12: disputa del comprador ──
  // Instante de montaje: la ventana de 48h se mide contra este reloj
  // estable en vez de llamar Date.now() durante el render.
  const [mountedAt] = useState(() => Date.now());
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputePhotos, setDisputePhotos] = useState<
    { url: string; alt: string }[]
  >([]);
  const [disputeUploading, setDisputeUploading] = useState(false);
  const [disputeError, setDisputeError] = useState<string | null>(null);
  const disputeInputRef = useRef<HTMLInputElement>(null);

  const canDispute =
    Boolean(
      data &&
        user &&
        data.userId === user.id &&
        data.status === "DELIVERED" &&
        !data.disputedAt &&
        data.deliveredAt &&
        mountedAt - new Date(data.deliveredAt).getTime() <=
          48 * 60 * 60 * 1000,
    );

  const dispute = useMutation({
    mutationFn: async () => {
      await api.post(`/orders/${params.id}/dispute`, {
        reason: disputeReason,
        photos: disputePhotos.map((p) => p.url),
      });
    },
    onSuccess: async () => {
      setShowDisputeForm(false);
      setDisputeError(null);
      await queryClient.invalidateQueries({ queryKey: ["order", params.id] });
    },
    onError: (err) =>
      setDisputeError(extractApiError(err, "No pudimos abrir la disputa")),
  });

  const handleDisputeFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted = Array.from(fileList).slice(
      0,
      6 - disputePhotos.length,
    );
    setDisputeError(null);
    setDisputeUploading(true);
    try {
      const form = new FormData();
      for (const file of accepted) form.append("files", file);
      const res = await api.post<{ images: { url: string; key: string }[] }>(
        "/uploads/images",
        form,
      );
      setDisputePhotos((prev) => [
        ...prev,
        ...(res.data.images ?? []).map((img, i) => ({
          url: img.url,
          alt: `Evidencia ${prev.length + i + 1}`,
        })),
      ]);
    } catch (err) {
      setDisputeError(extractApiError(err, "No pudimos subir las fotos"));
    } finally {
      setDisputeUploading(false);
      if (disputeInputRef.current) disputeInputRef.current.value = "";
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando pedido…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver este pedido."
          action={
            <Button onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          }
        />
      </PageContainer>
    );
  }

  // Un 404 (el pedido no existe) y un 403 (pertenece a otra persona)
  // terminan deliberadamente en el mismo estado, para no revelarle a quien no
  // tiene acceso que el pedido sí existe. Cualquier otro fallo (red, timeout,
  // 500) es temporal y merece un reintento en vez de un mensaje terminal.
  const isNotFoundOrForbidden = isTerminalError(error, [404, 403]);

  if (isError && !isNotFoundOrForbidden) {
    return (
      <PageContainer>
        <EmptyState
          title="No pudimos cargar el pedido"
          description="Hubo un problema al conectar con el servidor. Puede ser temporal."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer>
        <EmptyState
          title="Pedido no encontrado"
          description="No pudimos encontrar ese pedido."
          action={
            <Button onClick={() => router.push("/orders")}>
              Volver a mis pedidos
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const shipping = data.shippingAddress as Record<string, string> | null;
  // Only the order's own buyer can cancel it (the API 403s anyone else), and
  // only while it's still legal to move to CANCELLED — i.e. PENDING or PAID,
  // never once it has shipped.
  const canCancel =
    data.userId === user.id && nextStatusesFor(data.status).includes("CANCELLED");

  return (
    <PageContainer size="default">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
      >
        ← Volver a mis pedidos
      </Link>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl text-text-primary sm:text-[28px]">
          Pedido <span className="tabular-nums">#{data.id.slice(0, 8)}</span>
        </h1>
        <Badge variant={ORDER_STATUS_VARIANT[data.status]}>
          {ORDER_STATUS_LABEL[data.status]}
        </Badge>
      </div>

      {(canCancel || cancelError || cancelSuccess) && (
        <div className="-mt-3 mb-6 flex flex-col items-start gap-2">
          {canCancel && (
            <Button
              variant="danger"
              size="sm"
              disabled={cancelOrder.isPending}
              onClick={() => {
                setCancelError(null);
                if (confirm("¿Cancelar este pedido? Esta acción no se puede deshacer.")) {
                  cancelOrder.mutate();
                }
              }}
            >
              {cancelOrder.isPending ? (
                <Spinner className="h-4 w-4" />
              ) : (
                "Cancelar pedido"
              )}
            </Button>
          )}
          {/* Neither message is nested inside `canCancel` above: a failed
              cancel due to a conflict (someone else changed the order's
              status first) refetches the real status, which can immediately
              flip `canCancel` to false — the explanation of *why* the button
              disappeared has to outlive the button itself, same as the
              success confirmation on a cancel that worked. */}
          {cancelError && (
            <p className="text-sm text-danger" role="alert">
              {cancelError}
            </p>
          )}
          {cancelSuccess && (
            <p role="status" className="text-sm text-success">
              Pedido cancelado.
            </p>
          )}
        </div>
      )}

      <Card className="mb-4">
        <h2 className="heading-card mb-4">Estado del pedido</h2>
        <OrderStatusTimeline status={data.status} />
        {data.status !== "CANCELLED" && (
          <p className="mt-4 text-sm text-text-muted">
            {ORDER_STATUS_REASSURANCE[data.status]}
          </p>
        )}
      </Card>

      {data.status === "DELIVERED" && (
        <p
          role="status"
          className="mb-4 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary"
        >
          <span className="font-semibold text-success">Pedido entregado.</span>{" "}
          Cuéntanos qué te pareció cada prenda: busca &ldquo;Escribir
          reseña&rdquo; junto al producto.
        </p>
      )}

      {/* Item 12: disputa del comprador — una sola por orden, dentro de las
          48h desde la entrega, con fotos obligatorias. Visible solo para el
          dueño mientras la ventana esté abierta. */}
      {canDispute && (
        <Card className="mb-4">
          <h2 className="heading-card mb-2">¿Algo salió mal con tu pedido?</h2>
          <p className="mb-3 text-xs text-text-muted">
            Puedes abrir una disputa dentro de las 48 horas posteriores a la
            entrega. Solo puedes abrir una por pedido, y requiere fotos como
            evidencia.
          </p>
          {!showDisputeForm ? (
            <Button size="sm" variant="secondary" onClick={() => setShowDisputeForm(true)}>
              Abrir una disputa
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (disputePhotos.length === 0) {
                  setDisputeError("Adjunta al menos una foto como evidencia.");
                  return;
                }
                dispute.mutate();
              }}
              className="space-y-3"
            >
              <Textarea
                label="Motivo de la disputa"
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={4}
                placeholder="Describe qué pasó: estado real vs. fotos publicadas, prenda equivocada, etc."
                required
                minLength={20}
                maxLength={1000}
              />
              <div className="space-y-1">
                <label
                  htmlFor="dispute-photos"
                  className="block text-sm font-medium text-text-primary"
                >
                  Fotos de evidencia (obligatorias)
                </label>
                <input
                  id="dispute-photos"
                  ref={disputeInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={(e) => void handleDisputeFiles(e.target.files)}
                  className="block w-full text-sm text-text-primary file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-text-primary hover:file:bg-surface-muted"
                />
                <p className="text-xs text-text-muted">
                  JPG, PNG o WEBP. Máximo 6 fotos.
                </p>
                {disputePhotos.length > 0 && (
                  <ul className="text-xs text-text-muted">
                    {disputePhotos.map((photo, index) => (
                      <li key={photo.url}>
                        Foto {index + 1}: {photo.alt || photo.url}
                      </li>
                    ))}
                  </ul>
                )}
                {disputeUploading && (
                  <p className="text-xs text-text-muted">Subiendo fotos…</p>
                )}
              </div>
              {disputeError && (
                <p className="text-sm text-danger" role="alert">
                  {disputeError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={dispute.isPending || disputeUploading}>
                  {dispute.isPending ? "Enviando…" : "Enviar disputa"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowDisputeForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {(data.status === "DISPUTED" || data.disputeReason) && (
        <div
          role="status"
          className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary"
        >
          <span className="font-semibold">Disputa {data.disputeResolvedAt ? "resuelta" : "en revisión"}.</span>{" "}
          {data.disputeResolvedAt
            ? data.status === "REFUNDED"
              ? "Resuelta con reembolso al comprador."
              : "Revisada: no procede reembolso."
            : `Un administrador la resolverá antes de ${data.disputeExpiresAt ? new Date(data.disputeExpiresAt).toLocaleDateString("es-CO") : "30 días desde su apertura"}.`}
          {data.disputeReason && (
            <p className="mt-1 text-xs text-text-muted">
              Motivo declarado: {data.disputeReason}
              {data.disputePhotos && data.disputePhotos.length > 0
                ? ` (${data.disputePhotos.length} foto(s) adjuntas)`
                : ""}
            </p>
          )}
        </div>
      )}

      <Card>
        <h2 className="heading-card mb-3">Productos</h2>
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                {item.product?.images?.[0] ? (
                  <Image
                    src={item.product.images[0].url}
                    alt={item.product.title}
                    fill
                    sizes="64px"
                    priority={index === 0}
                    className="object-cover"
                  />
                ) : (
                  "—"
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${item.productId}`}
                  className="block truncate font-medium text-text-primary hover:underline"
                >
                  {item.product?.title ?? item.productId}
                </Link>
                {item.product && (
                  <p className="text-xs text-text-muted">
                    {conditionLabel(item.product.condition)} · Talla{" "}
                    {item.product.size}
                  </p>
                )}
                <p className="mt-1 text-sm text-text-muted">
                  <Price value={item.price} /> × {item.quantity}
                </p>
                {data.status === "DELIVERED" && (
                  <Link
                    href={`/products/${item.productId}#resenas`}
                    className="mt-1 inline-block text-xs font-medium text-text-primary underline-offset-4 hover:underline"
                  >
                    Escribir reseña
                  </Link>
                )}
              </div>
              <div className="font-semibold">
                <Price value={item.price * item.quantity} />
              </div>
            </div>
          ))}
        </div>
        <Divider className="my-4" />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">
            Total sin envío
          </span>
          <Price
            value={data.totalAmount}
            className="text-lg text-text-primary"
          />
        </div>
      </Card>

      {shipping && Object.keys(shipping).length > 0 && (
        <Card className="mt-4">
          <h2 className="heading-card mb-3">Dirección de envío</h2>
          <div className="space-y-1 text-sm text-text-primary">
            {shipping.street && <p>{shipping.street}</p>}
            {(shipping.city || shipping.state || shipping.zip) && (
              <p>
                {[shipping.city, shipping.state, shipping.zip]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {shipping.country && <p>{shipping.country}</p>}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="heading-card mb-2">Detalles del pedido</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Realizado el</dt>
            <dd className="text-text-primary">
              {new Date(data.createdAt).toLocaleString("es-CO")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Última actualización</dt>
            <dd className="text-text-primary">
              {new Date(data.updatedAt).toLocaleString("es-CO")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Estado</dt>
            <dd>
              <Badge variant={ORDER_STATUS_VARIANT[data.status]}>
                {ORDER_STATUS_LABEL[data.status]}
              </Badge>
            </dd>
          </div>
          {data.trackingNumber && (
            <div className="flex justify-between">
              <dt className="text-text-muted">Número de guía</dt>
              <dd className="font-medium text-text-primary">
                {data.trackingNumber}
              </dd>
            </div>
          )}
        </dl>
      </Card>
    </PageContainer>
  );
}
