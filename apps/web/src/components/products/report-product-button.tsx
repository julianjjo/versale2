"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { loginRedirectUrl, useAuth } from "@/lib/auth";
import { api, extractApiError } from "@/lib/api";
import { Button, Textarea, Select } from "@/components/ui";
import { REPORT_CATEGORY_OPTIONS } from "@/lib/report-category";

export function ReportProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reportProduct = useMutation({
    mutationFn: async () => {
      await api.post("/reports", { productId, category, reason: reason.trim() });
    },
    onSuccess: () => {
      setIsOpen(false);
      setCategory("");
      setReason("");
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos enviar tu reporte")),
  });

  const handleToggle = () => {
    // AuthProvider starts as `{ user: null, isLoading: true }` while it
    // verifies a persisted token — treating that as "logged out" would
    // wrongly redirect an already-authenticated visitor who clicks during
    // that brief startup window.
    if (isAuthLoading) return;

    if (!user) {
      router.push(loginRedirectUrl(productId, "report"));
      return;
    }

    setError(null);
    setIsOpen((open) => !open);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!category || !trimmed || trimmed.length > 500) return;
    setError(null);
    reportProduct.mutate();
  };

  // `useMutation`'s own isSuccess already tracks "was this sent" — a
  // separate boolean would have to be kept in sync by hand on every success
  // path instead of being read directly off the thing that caused it.
  if (reportProduct.isSuccess) {
    return (
      <p role="status" className="text-sm text-text-muted">
        Gracias, un administrador revisará esta publicación.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isAuthLoading}
        aria-expanded={isOpen}
        className="text-sm font-medium text-text-muted underline-offset-2 hover:text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-60"
      >
        Reportar publicación
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-2 max-w-md space-y-2">
          <Select
            label="Motivo del reporte"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Selecciona un motivo</option>
            {REPORT_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Cuéntanos más"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            maxLength={500}
            placeholder="Ej. sospecho que es una estafa, las fotos no coinciden con la descripción…"
          />
          <span className="text-xs text-text-muted">{reason.trim().length}/500</span>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={
                reportProduct.isPending ||
                !category ||
                !reason.trim() ||
                reason.trim().length > 500
              }
            >
              {reportProduct.isPending ? "Enviando…" : "Enviar reporte"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              disabled={reportProduct.isPending}
            >
              Cancelar
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
