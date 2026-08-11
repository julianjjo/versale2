"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await signup(email, name, password);
      router.push("/products");
    } catch (err) {
      setError(extractApiError(err, "No pudimos crear tu cuenta"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer size="narrow">
      <Card>
        <h1 className="heading-section text-text-primary">Crear cuenta</h1>
        <p className="mt-1 text-sm text-text-muted">
          Únete a Versale para comprar y vender moda de segunda.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Nombre"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            hint="Mínimo 6 caracteres."
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
            {isLoading ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-text-muted">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Iniciar sesión
          </Link>
        </p>
      </Card>
    </PageContainer>
  );
}
