import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/products/product-detail";
import type { Product } from "@/lib/types";
import { API_URL } from "@/lib/site";


// The listing is resolved on the server first so a product that no longer
// exists (deleted, rejected, never approved) answers with a real HTTP 404
// instead of a 200 that merely *looks* like an error page: crawlers, uptime
// monitors and link previews read the status code, not the Spanish copy.
//
// Wrapped in React's cache() because Next's own fetch memoization opts out
// whenever a `signal` is present (see next/dist/server/lib/dedupe-fetch.js) —
// without this, generateMetadata below and the page body each fired their
// own real request to the API for the same render, despite the comment that
// used to live on generateMetadata claiming otherwise.
const lookupProduct = cache(async (id: string): Promise<Product | null | undefined> => {
  try {
    const response = await fetch(
      `${API_URL}/products/${encodeURIComponent(id)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        // A hung API must not stall the whole page response: an aborted
        // fetch throws, which the catch below already degrades to
        // "unavailable" so the client query can offer a retry instead.
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) return undefined;
    return (await response.json()) as Product;
  } catch {
    // API unreachable: not a reason to claim the product is gone. Fall through
    // to the client query so the visitor gets the retryable error state.
    return undefined;
  }
});

// Item 11: dynamic metadata — the listing's own title/description in the
// tags crawlers and link previews read. Shares the server-side lookup with
// the page render via the cache() wrapper above.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await lookupProduct(id);


  if (!product) {
    return { title: "Producto no encontrado — Versale" };
  }

  // The first image's alt doubles as og:image alt; the title is the fallback.
  // ponytail: truncate inline slice; restore helper with Intl.Segmenter if emoji at boundary
  const description = product.description.length <= 160 ? product.description : product.description.slice(0, 157) + "...";

  return {
    title: `${product.title} — Versale`,
    description,
    openGraph: {
      title: product.title,
      description,
      images: product.images?.[0]
        ? [{ url: product.images[0].url, alt: product.images[0].alt }]
        : undefined,
    },
  };
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

  const product = await lookupProduct(id);
  if (product === null) notFound();

  return <ProductDetail initialProduct={product ?? undefined} />;
}
