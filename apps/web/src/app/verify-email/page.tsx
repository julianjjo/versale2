"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, PageContainer, Spinner } from "@/components/ui";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { refresh } = useAuth();
  const hasSubmitted = useRef(false);

  const verifyEmail = useMutation({
    mutationFn: async () => {
      await api.post("/auth/verify-email", { token });
    },
    onSuccess: () => {
      // A visitor who followed this link while already signed in has a
      // cached profile that still shows isVerified: false — refresh it so
      // the badge on /profile (and anywhere else that reads it) is correct
      // immediately, without waiting for their next full page load.
      refresh();
    },
  });

  useEffect(() => {
    if (!token || hasSubmitted.current) return;
    hasSubmitted.current = true;
    verifyEmail.mutate();
    // Runs once per token value; `verifyEmail` itself is a fresh object
    // every render and would otherwise re-trigger this on every mutation
    // state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">Enlace inválido</h1>
        <p className="mt-1 text-sm text-text-muted">
          Este enlace de verificación no es válido.
        </p>
        <p className="mt-4 text-sm">
          <Link
            href="/profile"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Ir a tu perfil
          </Link>
        </p>
      </Card>
    );
  }

  if (verifyEmail.isError) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          No pudimos verificar tu correo
        </h1>
        <p className="mt-1 text-sm text-danger" role="alert">
          {extractApiError(
            verifyEmail.error,
            "El enlace no es válido o ya fue usado",
          )}
        </p>
        <p className="mt-4 text-sm">
          <Link
            href="/profile"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Ir a tu perfil
          </Link>
        </p>
      </Card>
    );
  }

  if (verifyEmail.isSuccess) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          ¡Correo verificado!
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Tu correo se verificó correctamente.
        </p>
        <Button
          className="mt-6"
          variant="accent"
          fullWidth
          size="lg"
          onClick={() => router.push("/profile")}
        >
          Ir a tu perfil
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
        <Spinner className="h-5 w-5" /> Verificando tu correo…
      </div>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <PageContainer size="narrow">
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
            <Spinner className="h-5 w-5" /> Cargando…
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </PageContainer>
  );
}
