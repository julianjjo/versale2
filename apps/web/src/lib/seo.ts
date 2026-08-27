import type { Product } from "./types";

const AVAILABILITY: Record<string, string> = {
  AVAILABLE: "https://schema.org/InStock",
  SOLD: "https://schema.org/SoldOut",
  WITHDRAWN: "https://schema.org/Discontinued",
};

export function buildProductJsonLd(product: Product, siteUrl: string) {
  const availability = AVAILABILITY[typeof product.status === "string" ? product.status.trim() : product.status] ?? "https://schema.org/OutOfStock";
  const images = product.images?.map((i) => typeof i.url === "string" ? i.url.trim() : "").filter(Boolean) ?? [];
  const url = `${siteUrl.trim().replace(/\/+$/, "")}/products/${encodeURIComponent(product.id)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: typeof product.title === "string" ? product.title.trim() : product.title,
    description: typeof product.description === "string" ? product.description.trim() : product.description,
    image: images.length ? images : undefined,
    url,
    offers: {
      "@type": "Offer",
      price: typeof product.price === "string" ? Number(product.price.trim()) : product.price,
      priceCurrency: "COP",
      availability,
      url,
      seller: product.seller?.name?.trim()
        ? { "@type": "Organization", name: product.seller.name.trim() }
        : undefined,
    },
  };
}
