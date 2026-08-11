import { ProductsBrowser } from "@/components/products/products-browser";
import { PageContainer, SectionHeader } from "@/components/ui";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string }>;
}) {
  const { published } = await searchParams;

  return (
    <PageContainer size="wide">
      <SectionHeader
        title="Explorar marketplace"
        description="Encuentra prendas de segunda de vendedores de la comunidad."
      />
      {published === "1" && (
        <p
          role="status"
          className="mb-6 rounded-md border border-success/30 bg-success/10 px-4 py-3 text-sm text-text-primary"
        >
          <span className="font-semibold text-success">
            ¡Publicación enviada!
          </span>{" "}
          Un administrador revisará tu producto antes de que aparezca en el
          marketplace.
        </p>
      )}
      <ProductsBrowser />
    </PageContainer>
  );
}
