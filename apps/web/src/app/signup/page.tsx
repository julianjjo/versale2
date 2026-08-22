"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { extractApiError } from "@/lib/api";
import { Input, Button, Card, PageContainer, Checkbox } from "@/components/ui";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Item 8: explicit consent — legal requirement, not a silent footer note.
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!acceptedTerms) {
      setError(
        "Debes confirmar que eres mayor de 18 años y aceptas los Términos y la Política de privacidad.",
      );
      return;
    }
    setIsLoading(true);
    try {
      await signup(email, name, password, acceptedTerms);
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
            minLength={8}
            autoComplete="new-password"
            hint="Mínimo 8 caracteres."
          />
          <Checkbox
            label={
              <span className="text-xs leading-relaxed text-text-muted">
                Confirmo que soy mayor de 18 años y acepto los{" "}
                <Link
                  href="/terminos"
                  className="font-medium text-text-primary underline underline-offset-4"
                >
                  Términos y condiciones
                </Link>{" "}
                y la{" "}
                <Link
                  href="/privacidad"
                  className="font-medium text-text-primary underline underline-offset-4"
                >
                  Política de privacidad
                </Link>
                .
              </span>
            }
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
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
