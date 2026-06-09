import { ProductsBrowser } from "@/components/products/products-browser";
import { PageContainer, SectionHeader } from "@/components/ui";

export default function ProductsPage() {
  return (
    <PageContainer size="wide">
      <SectionHeader
        title="Explorar marketplace"
        description="Encuentra prendas de segunda de vendedores de la comunidad."
      />
      <ProductsBrowser />
    </PageContainer>
  );
}
