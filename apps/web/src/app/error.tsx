"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, EmptyState, PageContainer } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El detalle técnico queda en la consola: el mensaje crudo suele venir en
    // inglés desde el backend, así que nunca se lo mostramos a la persona.
    console.error(error);
  }, [error]);

  return (
    <PageContainer size="narrow" className="py-16 sm:py-20">
      <EmptyState
        icon={
          <span aria-hidden="true" className="font-display text-xl font-medium">
            !
          </span>
        }
        title="Algo salió mal"
        description="No pudimos mostrar esta página. Puedes intentarlo de nuevo; si el problema sigue, vuelve al inicio y escríbenos desde la página de contacto."
        action={
          <div className="flex flex-col items-center gap-3">
            <Button variant="accent" size="lg" onClick={() => reset()}>
              Reintentar
            </Button>
            <Link
              href="/"
              className="text-sm font-medium text-text-primary underline-offset-4 hover:underline"
            >
              Volver al inicio
            </Link>
          </div>
        }
      />
    </PageContainer>
  );
}
