"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { isTerminalError } from "@/lib/http-error";
import { Spinner, EmptyState, Button, PageContainer, SectionHeader } from "@/components/ui";
import { ProductsBrowser } from "@/components/products/products-browser";

interface SellerProfile {
  id: string;
  name: string;
  memberSince: string;
  activeListings: number;
}

const memberSinceFormatter = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "long",
});

export default function SellerProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery<SellerProfile>({
    queryKey: ["seller-profile", params.id],
    queryFn: async () => {
      const response = await api.get<SellerProfile>(
        `/products/sellers/${params.id}`,
      );
      return response.data;
    },
    enabled: Boolean(params.id),
  });

  if (isError) {
    const notFound = isTerminalError(error, [404]);
    return (
      <PageContainer size="narrow">
        <EmptyState
          title={notFound ? "Vendedor no encontrado" : "No pudimos cargar este perfil"}
          description={
            notFound
              ? "Este vendedor no existe o todavía no tiene publicaciones aprobadas."
              : "Ocurrió un error al conectar con el servidor. Intenta de nuevo."
          }
          action={
            <Button onClick={() => router.push("/products")}>
              Explorar productos
            </Button>
          }
        />
      </PageContainer>
    );
  }

  // The listings grid below only needs the seller id from the URL, which is
  // already known — it doesn't need to wait for this profile lookup to
  // resolve, so it renders in parallel with it instead of after it.
  return (
    <PageContainer size="wide">
      {isLoading || !data ? (
        <div className="mb-6 flex items-center gap-2 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : (
        <SectionHeader
          title={data.name}
          description={`Miembro desde ${memberSinceFormatter.format(new Date(data.memberSince))} · ${data.activeListings} ${data.activeListings === 1 ? "publicación activa" : "publicaciones activas"}`}
        />
      )}
      {params.id && (
        <ProductsBrowser
          initialFilters={{ sellerId: params.id }}
          showFilters={false}
          showPagination
        />
      )}
    </PageContainer>
  );
}
