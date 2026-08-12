import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer } from "@/components/ui";

export const metadata: Metadata = { title: "Página no encontrada — Versale" };

export default function NotFound() {
  return (
    <PageContainer size="narrow" className="py-16 sm:py-20">
      <EmptyState
        icon={
          <span aria-hidden="true" className="font-display text-base font-medium">
            404
          </span>
        }
        title="No encontramos esta página"
        description="El enlace que seguiste no existe o la prenda que buscas ya no está publicada. Vuelve al catálogo para seguir explorando."
        action={
          <Link href="/products" className="btn-pill btn-pill-primary">
            Ver el catálogo
            <span className="arrow" aria-hidden>
              →
            </span>
          </Link>
        }
      />
    </PageContainer>
  );
}
