"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email, password);
      router.push("/products");
    } catch (err) {
      setError(extractApiError(err, "No pudimos iniciar sesión"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <Card>
        <h1 className="heading-section text-text-primary">Bienvenido de vuelta</h1>
        <p className="mt-1 text-sm text-text-muted">
          Inicia sesión para comprar y vender en Versale.
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
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isLoading} fullWidth size="lg">
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
    </PageContainer>
  );
}
