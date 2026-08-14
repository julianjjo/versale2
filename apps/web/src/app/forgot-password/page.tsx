"use client";

import { useState } from "react";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer } from "@/components/ui";

interface ForgotPasswordResponse {
  message: string;
  // Only present when the API opts in via AUTH_EXPOSE_RESET_TOKEN (off by
  // default) — no email provider is wired up yet, so that flag lets a local
  // dev environment get the token back directly for testing.
  resetToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ForgotPasswordResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const response = await api.post<ForgotPasswordResponse>(
        "/auth/forgot-password",
        { email },
      );
      setResult(response.data);
    } catch (err) {
      setError(
        extractApiError(err, "No pudimos procesar la solicitud"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <Card>
        <h1 className="heading-section text-text-primary">
          Recuperar contraseña
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Ingresa tu correo y te enviaremos instrucciones para restablecer tu
          contraseña.
        </p>

        {result ? (
          <div className="mt-6 space-y-4">
            <p role="status" className="text-sm text-text-primary">
              {result.message}
            </p>
            {result.resetToken && (
              <div className="rounded-md border border-border bg-surface-muted p-3 text-sm">
                <p className="text-text-muted">
                  Modo de desarrollo: no hay un proveedor de correo
                  configurado, así que aquí tienes el enlace directo.
                </p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(result.resetToken)}`}
                  className="mt-2 block break-all font-medium text-text-primary underline-offset-4 hover:underline"
                >
                  Restablecer contraseña
                </Link>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="accent"
              disabled={isLoading}
              fullWidth
              size="lg"
            >
              {isLoading ? "Enviando…" : "Enviar instrucciones"}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-text-muted">
          <Link
            href="/login"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Volver a iniciar sesión
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
