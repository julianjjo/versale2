"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Textarea, Card } from "@/components/ui";
import type { ProductQuestion } from "@/lib/types";

export function ProductQuestions({
  productId,
  isOwn,
  isApproved,
  questions,
}: {
  productId: string;
  isOwn: boolean;
  isApproved: boolean;
  questions: ProductQuestion[];
}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [questionText, setQuestionText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");

  // Questions are embedded in GET /products/:id (see ProductsService#findOne),
  // so refreshing that same cached product after any mutation here is enough
  // to show the result — no separate questions query to keep in sync.
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["product", productId] });

  const askQuestion = useMutation({
    mutationFn: async () => {
      await api.post("/questions", { productId, question: questionText });
    },
    onSuccess: () => {
      invalidate();
      setQuestionText("");
      setError(null);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos enviar tu pregunta")),
  });

  const answerQuestion = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      await api.patch(`/questions/${id}/answer`, { answer });
    },
    onSuccess: () => {
      invalidate();
      setAnsweringId(null);
      setAnswerText("");
      setError(null);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos guardar la respuesta")),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/questions/${id}`);
    },
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la pregunta")),
  });

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    askQuestion.mutate();
  };

  const handleAnswerSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    setError(null);
    answerQuestion.mutate({ id, answer: answerText });
  };

  return (
    <section id="preguntas" className="mt-12">
      <h2 className="heading-section mb-4 text-text-primary">
        Preguntas y respuestas
      </h2>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-text-muted">Aún no hay preguntas.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <Card key={q.id}>
              <p className="text-sm font-medium text-text-primary">
                {q.asker?.name ?? "Anónimo"} preguntó:
              </p>
              <p className="mt-1 text-sm text-text-primary">{q.question}</p>
              <p className="mt-1 text-xs text-text-muted">
                {new Date(q.createdAt).toLocaleDateString("es-CO")}
              </p>

              {q.answer && (
                <div className="mt-3 rounded-md border border-border bg-surface-muted p-3">
                  <p className="text-xs font-semibold text-text-primary">
                    Respuesta del vendedor
                  </p>
                  <p className="mt-1 text-sm text-text-primary">{q.answer}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {isOwn &&
                  (answeringId === q.id ? (
                    <form
                      onSubmit={(e) => handleAnswerSubmit(e, q.id)}
                      className="w-full space-y-2"
                    >
                      <Textarea
                        label="Tu respuesta"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={answerQuestion.isPending}
                        >
                          {answerQuestion.isPending
                            ? "Guardando…"
                            : "Guardar respuesta"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setAnsweringId(null)}
                          disabled={answerQuestion.isPending}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAnsweringId(q.id);
                        setAnswerText(q.answer ?? "");
                      }}
                    >
                      {q.answer ? "Editar respuesta" : "Responder"}
                    </Button>
                  ))}

                {q.askerId === user?.id && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm("¿Eliminar esta pregunta?")) {
                        deleteQuestion.mutate(q.id);
                      }
                    }}
                    disabled={deleteQuestion.isPending}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Matches ReviewsForm's own gate in product-detail.tsx: hidden for an
          anonymous visitor (the page's shared "inicia sesión" nudge covers
          that), for the product's own seller, and while it isn't approved. */}
      {user && !isOwn && isApproved && (
        <form
          onSubmit={handleAsk}
          className="mt-6 max-w-md space-y-3 rounded-lg border border-border bg-surface p-4"
        >
          <h3 className="heading-card">Haz una pregunta</h3>
          <Textarea
            label="Tu pregunta para el vendedor"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={3}
            required
            maxLength={500}
            placeholder="Ej. ¿esta prenda tiene alguna mancha o defecto?"
          />
          <Button
            type="submit"
            disabled={askQuestion.isPending || !questionText.trim()}
          >
            {askQuestion.isPending ? "Enviando…" : "Enviar pregunta"}
          </Button>
        </form>
      )}
    </section>
  );
}
