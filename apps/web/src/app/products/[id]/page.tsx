import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        // A hung API must not stall the whole page response: an aborted
        // fetch throws, which the catch below already degrades to
        // "unavailable" so the client query can offer a retry instead.
        signal: AbortSignal.timeout(5000),
      },
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

// `.length`/`.slice()` count UTF-16 code units, not visible characters: a
// cut that lands inside a surrogate pair (an emoji outside the BMP) or a ZWJ
// sequence (a multi-codepoint emoji like a family) leaves an orphaned
// surrogate in the string. Browsers/crawlers rendering that in a <meta> tag
// or a social preview show it as U+FFFD (�) instead of the intended text.
// Intl.Segmenter walks grapheme clusters instead, so a cut always lands on a
// boundary a human would recognize as "between two characters".
const descriptionSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export function truncateDescription(
  description: string,
  maxLength: number,
): string {
  const graphemes = [...descriptionSegmenter.segment(description)].map(
    (s) => s.segment,
  );
  if (graphemes.length <= maxLength) return description;
  return `${graphemes.slice(0, maxLength - 3).join("")}...`;
}

// Item 11: dynamic metadata — the listing's own title/description in the
// tags crawlers and link previews read. Shares the server-side lookup with
// the page render (Next dedupes identical fetches within one request).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await lookupProduct(id);

  if (result.status !== "ok") {
    return { title: "Producto no encontrado — Versale" };
  }

  const product = result.product;
  // The first image's alt doubles as og:image alt; the title is the fallback.
  const description = truncateDescription(product.description, 160);

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

  const result = await lookupProduct(id);
  if (result.status === "missing") notFound();

  return (
    <ProductDetail
      initialProduct={result.status === "ok" ? result.product : undefined}
    />
  );
}
