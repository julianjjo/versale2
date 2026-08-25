import type { Product } from "./types";

const AVAILABILITY: Record<string, string> = {
  AVAILABLE: "https://schema.org/InStock",
  SOLD: "https://schema.org/SoldOut",
  WITHDRAWN: "https://schema.org/Discontinued",
};

export function buildProductJsonLd(product: Product, siteUrl: string) {
  const availability = AVAILABILITY[product.status] ?? "https://schema.org/OutOfStock";
  const images = product.images?.map((i) => i.url).filter(Boolean) ?? [];
  const url = `${siteUrl.replace(/\/$/, "")}/products/${product.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: images.length ? images : undefined,
    url,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "COP",
      availability,
      url,
      seller: product.seller?.name
        ? { "@type": "Organization", name: product.seller.name }
        : undefined,
    },
  };
}
