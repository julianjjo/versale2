"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Card, PageContainer, Spinner } from "@/components/ui";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get("token") ?? "").trim();
  const { refresh } = useAuth();
  // Gated on a click, not fired on mere page load: corporate email-security
  // scanners and chat link-unfurlers issue a real GET/navigation to a link
  // before a human ever opens it, and the token is single-use — auto-firing
  // here let those automated visits silently burn it, leaving the real user
  // stuck on "El enlace no es válido o ya fue usado" for a link they never
  // clicked.
  const [confirmed, setConfirmed] = useState(false);

  // Mirrors the established "run once when a param is present" idiom (see
  // the order detail page's `enabled: Boolean(user && params.id)`) instead
  // of a mutation fired imperatively from an effect — react-query's own
  // per-key caching is what keeps this from re-submitting the token, no
  // manual ref guard needed.
  const { isError, error, isSuccess } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async ({ signal }) => {
      await api.post("/auth/verify-email", { token }, { signal });
      // A visitor who followed this link while already signed in has a
      // cached profile that still shows isVerified: false — refresh it so
      // the badge on /profile is correct immediately, without waiting for
      // their next full page load.
      await refresh();
      return true;
    },
    enabled: Boolean(token) && confirmed,
    retry: false,
  });

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

  if (isError) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          No pudimos verificar tu correo
        </h1>
        <p className="mt-1 text-sm text-danger" role="alert">
          {extractApiError(error, "El enlace no es válido o ya fue usado")}
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

  if (isSuccess) {
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

  if (!confirmed) {
    return (
      <Card>
        <h1 className="heading-section text-text-primary">
          Verifica tu correo
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Confirma para terminar de verificar tu correo electrónico.
        </p>
        <Button
          className="mt-6"
          variant="accent"
          fullWidth
          size="lg"
          onClick={() => setConfirmed(true)}
        >
          Verificar mi correo
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
