import type { MetadataRoute } from "next";
import { API_URL, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

type ProductLike = { id: string; updatedAt: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    "",
    "/products",
    "/ayuda",
    "/contacto",
    "/terminos",
    "/privacidad",
  ].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/products" ? "daily" : "monthly",
    priority: path === "" || path === "/products" ? 1 : 0.5,
  }));

  try {
    const products: ProductLike[] = [];
    const PAGE_SIZE = 100;
    const SITEMAP_MAX_URLS = 500;
    for (let page = 1; page <= 5; page++) {
      const res = await fetch(
        `${API_URL}/products?page=${page}&limit=${PAGE_SIZE}`,
        { signal: AbortSignal.timeout(5000), cache: "no-store" },
      );
      if (!res.ok) break;
      const body = (await res.json()) as {
        data: ProductLike[];
        meta?: { pages?: number };
      };
      products.push(...body.data);
      if (products.length >= SITEMAP_MAX_URLS) break;
      if (!body.meta?.pages || page >= body.meta.pages) break;
    }

    return [
      ...staticRoutes,
      ...products.slice(0, SITEMAP_MAX_URLS).map((p) => {
        const d = new Date(p.updatedAt);
        return {
          url: `${SITE_URL}/products/${encodeURIComponent(p.id)}`,
          lastModified: Number.isNaN(d.getTime()) ? new Date() : d,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        };
      }),
    ];
  } catch {
    return staticRoutes;
  }
}
