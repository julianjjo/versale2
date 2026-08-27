export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

// Item 11: canonical origin of the site. Used by sitemap.ts, robots.ts and
// any absolute-URL metadata (openGraph). Falls back to localhost so dev and
// E2E work without extra env; production sets NEXT_PUBLIC_SITE_URL.
export const SITE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_SITE_URL?.trim()
    ? process.env.NEXT_PUBLIC_SITE_URL!
    : "http://localhost:3000",
) || "http://localhost:3000";

// Server-side API base — same value the client lib uses, but readable from
// server components/routes (sitemap) where NEXT_PUBLIC_ inlining also works.
export const API_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_API_URL?.trim()
    ? process.env.NEXT_PUBLIC_API_URL!
    : "http://localhost:3001",
) || "http://localhost:3001";
