"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Textarea, Card } from "@/components/ui";
import { SellerReplyBlock } from "@/components/products/seller-reply-block";
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

  // Read in the (async) mutation callbacks below to check "is this response
  // for the question still open in the editor" against the *latest* value,
  // not whatever `answeringId` this callback's own closure happened to
  // capture when the mutation was created.
  const answeringIdRef = useRef(answeringId);
  useEffect(() => {
    answeringIdRef.current = answeringId;
  }, [answeringId]);

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
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos enviar tu pregunta")),
  });

  const answerQuestion = useMutation({
    mutationFn: async ({ id, answer }: { id: string; answer: string }) => {
      await api.patch(`/questions/${id}/answer`, { answer });
    },
    // Only clears the editor if it's still open on the question this
    // response is actually for — otherwise a slow save for question A
    // completing after the seller has already moved on to answering
    // question B would wipe B's in-progress draft out from under them.
    onSuccess: (_data, variables) => {
      invalidate();
      if (answeringIdRef.current === variables.id) {
        setAnsweringId(null);
        setAnswerText("");
      }
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos guardar la respuesta")),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/questions/${id}`);
    },
    onSuccess: () => invalidate(),
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la pregunta")),
  });

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (questionText.trim().length === 0 || questionText.length > 500) return;
    setError(null);
    askQuestion.mutate();
  };

  // Switching to a different question's answer box while the current one has
  // unsaved text would otherwise silently discard it — this is the only
  // place that can happen, since submitting or cancelling both clear it
  // through their own paths.
  const startAnswering = (q: ProductQuestion) => {
    if (
      answeringId &&
      answeringId !== q.id &&
      answerText.trim() &&
      !confirm(
        "Tienes una respuesta sin guardar. ¿Descartarla y responder esta otra pregunta?",
      )
    ) {
      return;
    }
    setError(null);
    setAnsweringId(q.id);
    setAnswerText(q.answer ?? "");
  };

  const handleAnswerSubmit = (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!answerText.trim() || answerText.length > 1000) return;
    setError(null);
    answerQuestion.mutate({ id, answer: answerText });
  };

  const handleDelete = (id: string) => {
    if (confirm("¿Eliminar esta pregunta?")) {
      setError(null);
      deleteQuestion.mutate(id);
    }
  };

  return (
    <section id="preguntas" className="scroll-anchor mt-12">
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
                {new Date(q.createdAt).toLocaleDateString("es-CO", { timeZone: "UTC" })}
              </p>

              {q.answer && <SellerReplyBlock text={q.answer} />}

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
                        maxLength={1000}
                      />
                      <span className="text-xs text-text-muted">{answerText.length}/1000</span>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            answerQuestion.isPending ||
                            !answerText.trim() ||
                            answerText.length > 1000
                          }
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
                      onClick={() => startAnswering(q)}
                    >
                      {q.answer ? "Editar respuesta" : "Responder"}
                    </Button>
                  ))}

                {q.askerId === user?.id && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(q.id)}
                    disabled={
                      deleteQuestion.isPending &&
                      deleteQuestion.variables === q.id
                    }
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
          <span className="text-xs text-text-muted">{questionText.length}/500</span>
          <Button
            type="submit"
            disabled={askQuestion.isPending || !questionText.trim() || questionText.length > 500}
          >
            {askQuestion.isPending ? "Enviando…" : "Enviar pregunta"}
          </Button>
        </form>
      )}
    </section>
  );
}
