import { ProductsBrowser } from "@/components/products/products-browser";

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Browse products</h1>
      <ProductsBrowser />
    </div>
  );
}
