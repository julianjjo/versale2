"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer, Spinner } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err) {
      setError(
        extractApiError(err, "No pudimos restablecer tu contraseña"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          Enlace inválido
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Este enlace para restablecer la contraseña no es válido. Solicita
          uno nuevo.
        </p>
        <p className="mt-4 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Solicitar un nuevo enlace
          </Link>
        </p>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          Contraseña actualizada
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
        </p>
        <Button
          className="mt-6"
          variant="accent"
          fullWidth
          size="lg"
          onClick={() => router.push("/login")}
        >
          Iniciar sesión
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="heading-section text-text-primary">
        Restablecer contraseña
      </h1>
      <p className="mt-1 text-sm text-text-muted">
        Elige una nueva contraseña para tu cuenta.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          type="password"
          label="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <Input
          type="password"
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
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
          {isLoading ? "Actualizando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <PageContainer size="narrow">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
            <Spinner className="h-5 w-5" /> Cargando…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </PageContainer>
  );
}
