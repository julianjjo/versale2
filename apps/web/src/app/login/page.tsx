"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer, Spinner } from "@/components/ui";
import { safeLoginRedirect } from "./safe-redirect";

const LOGIN_REASON_MESSAGE: Record<string, string> = {
  cart: "Inicia sesión para agregar este producto a tu carrito.",
  review: "Inicia sesión para escribir tu reseña.",
  helpful: "Inicia sesión para marcar una reseña como útil.",
  expired: "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
  password_changed:
    "Tu contraseña se actualizó. Inicia sesión de nuevo con la nueva contraseña.",
  account_deleted:
    "Tu cuenta se eliminó correctamente. Si alguna vez quieres volver, puedes crear una cuenta nueva con el mismo correo.",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const next = searchParams.get("next")?.trim() ?? null;
  const reason = searchParams.get("reason")?.trim() ?? "";
  // `reason` viene de la URL: sin verificar que la clave sea propia, valores
  // como "__proto__" devuelven objetos heredados y React no puede renderizarlos.
  const notice =
    reason && Object.hasOwn(LOGIN_REASON_MESSAGE, reason)
      ? LOGIN_REASON_MESSAGE[reason]
      : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      router.push(safeLoginRedirect(next));
    } catch (err) {
      setError(extractApiError(err, "No pudimos iniciar sesión"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <h1 className="heading-section text-text-primary">Bienvenido de vuelta</h1>
      <p className="mt-1 text-sm text-text-muted">
        {notice ?? "Inicia sesión para comprar y vender en Versale."}
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          type="password"
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="current-password"
        />
        <p className="-mt-2 text-right text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
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
          {isLoading ? "Ingresando…" : "Iniciar sesión"}
        </Button>
      </form>
      <p className="mt-4 text-sm text-text-muted">
        ¿No tienes cuenta?{" "}
        <Link
          href="/signup"
          className="font-medium text-text-primary underline-offset-4 hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <PageContainer size="narrow">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
            <Spinner className="h-5 w-5" /> Cargando…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </PageContainer>
  );
}
