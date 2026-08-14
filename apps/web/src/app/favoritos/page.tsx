"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useFavorites } from "@/lib/favorites";
import {
  Button,
  EmptyState,
  PageContainer,
  SectionHeader,
  Spinner,
} from "@/components/ui";
import { ProductCard } from "@/components/products/products-browser";
import type { Product } from "@/lib/types";

export default function FavoritosPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data, isLoading, isLoadingError, refetch } = useFavorites();

  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver tus favoritos."
          action={
            <Button onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando tus favoritos…
        </div>
      </PageContainer>
    );
  }

  if (isLoadingError) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="No pudimos cargar tus favoritos"
          description="Ocurrió un error al conectar con el servidor. Intenta de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </PageContainer>
    );
  }

  // `Favorite.product` is typed optional (the join could in principle come
  // back empty), so this narrows defensively before handing the array to
  // `ProductCard`, which requires a `Product`.
  const products = (data ?? [])
    .map((favorite) => favorite.product)
    .filter((product): product is Product => Boolean(product));

  return (
    <PageContainer size="wide">
      <SectionHeader
        title="Tus favoritos"
        description="Los productos que has guardado para más tarde."
      />

      {products.length === 0 ? (
        <EmptyState
          title="Aún no tienes favoritos"
          description="Explora el marketplace y guarda lo que te guste tocando el corazón."
          action={
            <Button onClick={() => router.push("/products")}>
              Explorar productos
            </Button>
          }
        />
      ) : (
        <div className="products-grid grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
