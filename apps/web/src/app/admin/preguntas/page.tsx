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
import type { ProductQuestion } from "@/lib/types";

export default function AdminQuestionsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["admin-questions", page],
    queryFn: async ({ signal }) => {
      const res = await api.get<{
        data: ProductQuestion[];
        meta: { total: number; page: number; pages: number };
      }>(`/questions/admin/all?page=${page}&limit=20`, { signal });
      return res.data;
    },
    // Igual que en las otras listas del panel: se conserva la página anterior
    // en pantalla mientras llega la siguiente en vez de vaciarla.
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/questions/${id}`);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-questions"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la pregunta")),
  });

  const questions = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <h1 className="heading-section mb-4 text-text-primary">
        Preguntas y respuestas
      </h1>

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
        <EmptyState title="No pudimos cargar las preguntas" />
      ) : questions.length === 0 ? (
        <EmptyState
          title="No hay preguntas"
          description="Cuando un comprador le pregunte algo a un vendedor, aparecerá aquí."
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {questions.map((question) => (
            <Card key={question.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  {question.product ? (
                    <Link
                      href={`/products/${question.product.id}?preview=1`}
                      className="block truncate font-medium text-text-primary hover:underline"
                    >
                      {question.product.title}
                    </Link>
                  ) : (
                    <p className="truncate font-medium text-text-primary">
                      Producto eliminado
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    Preguntado por {question.asker?.name ?? "Usuario eliminado"}
                    {" · "}
                    {new Date(question.createdAt).toLocaleDateString("es-CO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm text-text-primary">
                    {question.question}
                  </p>
                  {question.answer && (
                    <p className="mt-2 whitespace-pre-line rounded-md border border-border bg-surface-muted p-2 text-sm text-text-primary">
                      <span className="font-semibold">
                        Respuesta del vendedor:{" "}
                      </span>
                      {question.answer}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm("¿Eliminar esta pregunta?")) {
                      remove.mutate(question.id);
                    }
                  }}
                  disabled={remove.isPending}
                >
                  Eliminar
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
