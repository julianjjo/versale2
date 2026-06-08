import { ProductsBrowser } from "@/components/products/products-browser";
import { PageContainer, SectionHeader } from "@/components/ui";

export default function ProductsPage() {
  return (
    <PageContainer size="wide">
      <SectionHeader
        title="Browse marketplace"
        description="Find pre-owned pieces from sellers in the community."
      />
      <ProductsBrowser />
    </PageContainer>
  );
}
