import { describe, it, expect } from "vitest";
import { buildProductJsonLd } from "../seo";
import type { Product } from "../types";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "Campera vintage",
    description: "Denim en buen estado",
    category: "Jackets",
    brand: "Levi's",
    size: "M",
    condition: "Good",
    price: 45000,
    sellerId: "s1",
    isApproved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "AVAILABLE",
    images: [{ url: "https://cdn.example.com/a.jpg", alt: "a" }],
    seller: { id: "s1", name: "Ana" },
    ...overrides,
  } as Product;
}

describe("buildProductJsonLd", () => {
  it("mapea AVAILABLE a InStock con COP y url canonica", () => {
    const json = buildProductJsonLd(product({ status: "AVAILABLE" }), "https://versale.ar");
    expect(json["@type"]).toBe("Product");
    expect(json.offers.availability).toBe("https://schema.org/InStock");
    expect(json.offers.priceCurrency).toBe("COP");
    expect(json.offers.price).toBe(45000);
    expect(json.url).toBe("https://versale.ar/products/p1");
    expect(json.offers.url).toBe("https://versale.ar/products/p1");
  });

  it("mapea SOLD a SoldOut", () => {
    const json = buildProductJsonLd(product({ status: "SOLD" }), "https://versale.ar");
    expect(json.offers.availability).toBe("https://schema.org/SoldOut");
  });

  it("mapea WITHDRAWN a Discontinued", () => {
    const json = buildProductJsonLd(product({ status: "WITHDRAWN" }), "https://versale.ar");
    expect(json.offers.availability).toBe("https://schema.org/Discontinued");
  });

  it("mapea estado desconocido a OutOfStock", () => {
    const json = buildProductJsonLd(product({ status: "UNKNOWN" as unknown as Product["status"] }), "https://versale.ar");
    expect(json.offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("expone imagen, seller y serializa sin </script> sin escapar mal", () => {
    const json = buildProductJsonLd(
      product({
        images: [
          { url: "https://cdn.example.com/a.jpg", alt: "a" },
          { url: "https://cdn.example.com/b.jpg", alt: "b" },
        ],
        seller: { id: "s1", name: "Ana" },
      }),
      "https://versale.ar/",
    );
    expect(json.image).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]);
    expect(json.offers.seller).toEqual({ "@type": "Organization", name: "Ana" });
    // JSON.stringify debe ser parseable y no romper script tag
    const raw = JSON.stringify(json);
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(raw).not.toContain("</script>");
  });

  it("omite image y seller cuando faltan", () => {
    const json = buildProductJsonLd(product({ images: [], seller: undefined }), "https://versale.ar");
    expect(json.image).toBeUndefined();
    expect(json.offers.seller).toBeUndefined();
  });

  it("normaliza siteUrl con espacios y múltiples slashes", () => {
    const json = buildProductJsonLd(product(), " https://versale.ar/// ");
    expect(json.url).toBe("https://versale.ar/products/p1");
    expect(json.offers.url).toBe("https://versale.ar/products/p1");
  });

  it("trimmea seller name y omite si es solo espacios", () => {
    const withSpaces = buildProductJsonLd(product({ seller: { id: "s1", name: "  Ana  " } }), "https://versale.ar");
    expect(withSpaces.offers.seller).toEqual({ "@type": "Organization", name: "Ana" });
    const blank = buildProductJsonLd(product({ seller: { id: "s1", name: "   " } }), "https://versale.ar");
    expect(blank.offers.seller).toBeUndefined();
  });

  it("trimmea title y description", () => {
    const json = buildProductJsonLd(product({ title: "  Campera  ", description: "  Denim  " }), "https://versale.ar");
    expect(json.name).toBe("Campera");
    expect(json.description).toBe("Denim");
  });
});
