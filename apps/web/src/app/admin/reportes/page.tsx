"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api, extractApiError } from "@/lib/api";
import { useEffect } from "react";
import { Spinner, Card, EmptyState, Button, Badge } from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { reportCategoryLabel, reportCategoryBadgeVariant } from "@/lib/report-category";
import type { ProductReport } from "@/lib/types";

type StatusFilter = "open" | "dismissed" | "all";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "dismissed", label: "Descartados" },
  { value: "all", label: "Todos" },
];

const EMPTY_STATE_COPY: Record<StatusFilter, string> = {
  open: "No hay reportes abiertos",
  dismissed: "No hay reportes descartados",
  all: "No hay reportes",
};

export default function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [page, setPage] = useState(1);
  const [lastSeenPages, setLastSeenPages] = useState<number | undefined>(
    undefined,
  );

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["admin-reports", status, page],
    queryFn: async ({ signal }) => {
      const res = await api.get<{
        data: ProductReport[];
        meta: { total: number; page: number; pages: number };
      }>(`/reports/admin/all?status=${status}&page=${page}&limit=20`, { signal });
      return res.data;
    },
    // Igual que en las otras listas del panel: se conserva la página anterior
    // en pantalla mientras llega la siguiente en vez de vaciarla.
    placeholderData: keepPreviousData,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/reports/${id}/dismiss`);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos descartar el reporte")),
  });

  const reports = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (meta && meta.pages !== lastSeenPages) {
      setLastSeenPages(meta.pages);
      setPage((currentPage) => Math.min(currentPage, Math.max(1, meta.pages)));
    }
  }, [meta?.pages, lastSeenPages]);

  const setTab = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div>
      <h1 className="heading-section mb-4 text-text-primary">
        Publicaciones reportadas
      </h1>

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Filtrar por estado"
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={status === tab.value}
            onClick={() => setTab(tab.value)}
            className={`filter-pill ${status === tab.value ? "is-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
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
      ) : isError ? (
        <EmptyState title="No pudimos cargar los reportes" />
      ) : reports.length === 0 ? (
        <EmptyState
          title={EMPTY_STATE_COPY[status]}
          description={
            status === "open"
              ? "Cuando un comprador reporte una publicación, aparecerá aquí."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {report.product ? (
                      <Link
                        href={`/products/${report.product.id}?preview=1`}
                        className="truncate font-medium text-text-primary hover:underline"
                      >
                        {report.product.title}
                      </Link>
                    ) : (
                      <p className="truncate font-medium text-text-primary">
                        Producto eliminado
                      </p>
                    )}
                    <Badge variant={reportCategoryBadgeVariant(report.category)}>
                      {reportCategoryLabel(report.category)}
                    </Badge>
                    {report.status === "DISMISSED" && (
                      <Badge variant="default">Descartado</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-muted">
                    Reportado por {report.reporter?.name ?? "Usuario eliminado"}
                    {" · "}
                    {new Date(report.createdAt).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-text-primary">
                    {report.reason}
                  </p>
                  {report.status === "DISMISSED" && report.reviewedAt && (
                    <p className="mt-2 text-xs text-text-muted">
                      Descartado por{" "}
                      {report.reviewer?.name ?? "un administrador eliminado"}
                      {" · "}
                      {new Date(report.reviewedAt).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                {report.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (
                        confirm(
                          "¿Marcar este reporte como revisado y descartarlo? Podrás verlo luego en la pestaña Descartados.",
                        )
                      ) {
                        dismiss.mutate(report.id);
                      }
                    }}
                    disabled={dismiss.isPending && dismiss.variables === report.id}
                  >
                    Descartar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}
