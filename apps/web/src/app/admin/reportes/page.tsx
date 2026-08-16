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
import { Spinner, Card, EmptyState, Button } from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import type { ProductReport } from "@/lib/types";

export default function AdminReportsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["admin-reports", page],
    queryFn: async () => {
      const res = await api.get<{
        data: ProductReport[];
        meta: { total: number; page: number; pages: number };
      }>(`/reports/admin/all?page=${page}&limit=20`);
      return res.data;
    },
    // Igual que en las otras listas del panel: se conserva la página anterior
    // en pantalla mientras llega la siguiente en vez de vaciarla.
    placeholderData: keepPreviousData,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reports/${id}`);
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

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">
        Publicaciones reportadas
      </h2>

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
          title="No hay reportes"
          description="Cuando un comprador reporte una publicación, aparecerá aquí."
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  {report.product ? (
                    <Link
                      href={`/products/${report.product.id}?preview=1`}
                      className="block truncate font-medium text-text-primary hover:underline"
                    >
                      {report.product.title}
                    </Link>
                  ) : (
                    <p className="truncate font-medium text-text-primary">
                      Producto eliminado
                    </p>
                  )}
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
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => dismiss.mutate(report.id)}
                  disabled={dismiss.isPending}
                >
                  Descartar
                </Button>
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
