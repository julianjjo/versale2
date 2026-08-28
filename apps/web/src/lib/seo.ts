import type { Product } from "./types";

const AVAILABILITY: Record<string, string> = {
  AVAILABLE: "https://schema.org/InStock",
  SOLD: "https://schema.org/SoldOut",
  WITHDRAWN: "https://schema.org/Discontinued",
};

export function buildProductJsonLd(product: Product, siteUrl: string) {
  const rawStatus =
    typeof product.status === "string" ? product.status.trim().toUpperCase() : product.status;
  const availability = AVAILABILITY[rawStatus] ?? "https://schema.org/OutOfStock";
  const images = product.images?.map((i) => typeof i.url === "string" ? i.url.trim() : "").filter(Boolean) ?? [];
  const url = `${siteUrl.trim().replace(/\/+$/, "")}/products/${encodeURIComponent(typeof product.id === "string" ? product.id.trim() : String(product.id))}`;
  // The API can send price as a string even though Product types it as a
  // number, so widen before the typeof check — narrowing a `number` against
  // "string" would make the coercion branch `never`.
  const rawPrice = product.price as unknown;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: typeof product.title === "string" ? product.title.trim() : product.title,
    description: typeof product.description === "string" ? product.description.trim() : product.description,
    image: images.length ? images : undefined,
    url,
    offers: {
      "@type": "Offer",
      price:
        typeof rawPrice === "string" ? Number(rawPrice.trim()) : (rawPrice as number),
      priceCurrency: "COP",
      availability,
      url,
      seller: product.seller?.name?.trim()
        ? { "@type": "Organization", name: product.seller.name.trim() }
        : undefined,
    },
  };
}
