import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/products/product-detail";
import type { Product } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ProductLookup =
  | { status: "ok"; product: Product }
  | { status: "missing" }
  | { status: "unavailable" };

// The listing is resolved on the server first so a product that no longer
// exists (deleted, rejected, never approved) answers with a real HTTP 404
// instead of a 200 that merely *looks* like an error page: crawlers, uptime
// monitors and link previews read the status code, not the Spanish copy.
async function lookupProduct(id: string): Promise<ProductLookup> {
  try {
    const response = await fetch(
      `${API_URL}/products/${encodeURIComponent(id)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", product: (await response.json()) as Product };
  } catch {
    // API unreachable: not a reason to claim the product is gone. Fall through
    // to the client query so the visitor gets the retryable error state.
    return { status: "unavailable" };
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;

  // `?preview=1` is the escape hatch for a seller or admin opening a listing
  // that isn't public yet: the server probe is always anonymous (the JWT lives
  // in localStorage), so the API would answer 404 for a pending product this
  // visitor is in fact allowed to see. Skip the probe and let the client query
  // — which does carry the token — decide what to render.
  if (preview === "1") return <ProductDetail />;

  const result = await lookupProduct(id);
  if (result.status === "missing") notFound();

  return (
    <ProductDetail
      initialProduct={result.status === "ok" ? result.product : undefined}
    />
  );
}
