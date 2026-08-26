import type { MetadataRoute } from "next";
import { API_URL, SITE_URL } from "@/lib/site";

// Item 11: sitemap with only publicly visible listings. force-dynamic: the
// catalog changes on every approval — a build-time snapshot would go stale
// (and CI builds run without a reachable API, which the try/catch below
// degrades to static-routes-only).
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
    // PUBLICLY_VISIBLE on the API already filters to isApproved + AVAILABLE +
    // not paused, which is exactly the "solo aprobados" the roadmap asks for.
    // Paged walk with a hard cap so a huge catalog can't stall the route.
    // ponytail: sitemap caps 500, paginate/cursor if catalog >500
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
      if (!body.meta?.pages || page >= body.meta.pages) break;
    }
    if (products.length >= SITEMAP_MAX_URLS) console.warn(`[sitemap] truncated at ${SITEMAP_MAX_URLS} URLs — catalog exceeds cap`);

    return [
      ...staticRoutes,
      ...products.map((p) => ({
        url: `${SITE_URL}/products/${p.id}`,
        lastModified: new Date(p.updatedAt),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    // API down at request time: a sitemap of static routes beats a 500.
    return staticRoutes;
  }
}
